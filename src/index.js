const isNode = typeof process !== 'undefined' && process.versions?.node;

const AppDBClient = (inWorker = false, buffer = [], cachelock = []) => {
    if (isNode) inWorker = false;
    buffer = buffer.filter((storeName) => storeName !== 'buffer');
    const thread = 'main';
    let worker = null;

    if (inWorker) {
        const workerCode = `
        const thread = 'worker';
        const worker = null;
        const buffer = '${buffer}'.split(',');

        ${createUUID}
        ${objectId}
        ${difference}
        ${objectConverter}
        ${emptyObject}
        ${hasOperators}
        ${hasNestedOperators}
        ${openIndexedDB}
        ${getCollector}
        ${setItem}
        ${setItems}
        ${getItem}
        ${getItems}
        ${deleteItem}
        ${clearStore}

        const collector = getCollector();

        const methods = {
            setItem: setItem,
            setItems: setItems,
            getItem: getItem,
            getItems: getItems,
            deleteItem: deleteItem,
            clearStore: clearStore
        }

        self.onmessage = function(e) {
            const method = e.data[0].split(':')[0];
            methods[method](e.data[1], e.data[2], e.data[3], (error, result) => {
                if (!Array.isArray(result) || !result.length) {
                    self.postMessage([e.data[0], error, result]);
                } else {
                    const length = result.length;
                    while (result.length > 0) {
                        const part = result.splice(0, 1000);
                        self.postMessage([e.data[0], error, part, length]);
                    }
                }
                return result = null, delete e.data;
            }, e.data[4]);
        };`;

        const blob = new Blob([workerCode], {
            type: "application/json",
        });

        worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = function (e) {
            this.dispatchEvent(new CustomEvent(e.data[0], { bubbles: false, detail: { error: e.data[1], result: e.data[2], length: e.data[3] } }));
            return delete e.data;
        }
    }

    async function workerBridge(method, transfer, callback) {
        const target = `${method}:${(Math.random().toString(36).substring(2))}`;
        transfer = Array.from(transfer).filter((item) => typeof item !== 'function');
        transfer.unshift(target);
        worker.postMessage(transfer);
        let result = [];
        const workerResult = (e) => {
            if (e.detail.length) {
                result = result.concat(e.detail.result);
                if (result.length === e.detail.length || e.detail.error) {
                    callback(e.detail.error, result);
                    return worker.removeEventListener(target, workerResult), result = [];
                }
            } else {
                callback(e.detail.error, e.detail.result);
                return worker.removeEventListener(target, workerResult);
            }
        }
        return worker.addEventListener(target, workerResult), transfer = null;
    }

    function createUUID() {
        const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
        return chars[Math.floor(Math.random() * chars.length)] + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    function objectId() {
        const isObjectID = (id) => (/^[0-9A-F]{24}$/i.test(String(id)));
        const oid = Math.floor(new Date() / 1000).toString(16) + Math.random().toString(16).substring(2, 12) + Math.random().toString(16).substring(2, 8);
        return isObjectID(oid) ? oid : objectId();
    }

    function difference(a1, a2) {
        return [a1.filter(i => !a2.includes(i)), a2.filter(i => !a1.includes(i))];
    }

    function objectConverter(object = {}, result = false) {
        return Object.fromEntries(Object.entries(object).map((element, index, array) => {
            if (element[1] !== null && element[1] !== undefined) {
                if (!result) {
                    if (typeof element[1] === 'boolean') {
                        element[1] = String(element[1]);
                    } else if (element[1].$bound) {
                        element[1] = IDBKeyRange.bound(...element[1].$bound);
                    }
                } else {
                    if (element[1] === 'false') {
                        element[1] = false;
                    } else if (element[1] === 'true') {
                        element[1] = true;
                    }
                }
            }
            return element;
        }));
    }

    function emptyObject(object) {
        for (let i in object) return false;
        return true;
    }

    function hasOperators(object) {
        for (let i in object) {
            if (i[0] === '$') return true;
        }
        return false;
    }

    function hasNestedOperators(object) {
        const boundOperators = ['$bound', '$gt', '$lt', '$gte', '$lte'];
        for (let i in object) {
            for (let x in object[i]) {
                if (x[0] === '$' && !boundOperators.includes(x)) return true;
            }
        }
        return false;
    }

    function initIndexedDB(dbName, stores, callback) {
        function openDatabase(upgrade) {
            const dbRequest = upgrade ? indexedDB.open(dbName, upgrade) : indexedDB.open(dbName);

            dbRequest.onerror = function (event) {
                callback(event);
            }

            dbRequest.onupgradeneeded = function (event) {
                const database = event.target.result;

                database.onerror = function (event) {
                    callback(event);
                    database.close();
                }

                database.onversionchange = function (event) {
                    database.close();
                }

                function getStore(storeName) {
                    if (database.objectStoreNames.contains(storeName)) {
                        return event.currentTarget.transaction.objectStore(storeName);
                    } else {
                        return database.createObjectStore(storeName, { keyPath: "_id", autoIncrement: true });
                    }
                }

                for (let storeName of Object.keys(stores)) {
                    const objectStore = getStore(storeName);
                    const differentKeys = difference(stores[storeName], [...objectStore.indexNames]);

                    differentKeys[0].forEach(element => {
                        // if (element === '_id') return;
                        objectStore.createIndex(element, element, { unique: false, multiEntry: true });
                    });

                    differentKeys[1].forEach(element => {
                        // if (element === '_id') return;
                        objectStore.deleteIndex(element);
                    });
                }
            }

            dbRequest.onsuccess = function (event) {
                const database = event.target.result;
                const databaseStores = [...database.objectStoreNames];

                function upgradeDatabase() {
                    database.close();
                    openDatabase(database.version + 1);
                }

                const differentStores = difference(Object.keys(stores), databaseStores);
                if (differentStores[0].length > 0 || differentStores[1].length > 0) return upgradeDatabase();

                for (let storeName of databaseStores) {
                    const transaction = database.transaction([storeName]);
                    const objectStore = transaction.objectStore(storeName);
                    const differentKeys = difference(stores[storeName], [...objectStore.indexNames]);
                    if (differentKeys[0].length > 0 || differentKeys[1].length > 0) return upgradeDatabase();
                }

                callback(null, database, upgrade);
                database.close();
            }
        }

        openDatabase();
    }

    function openIndexedDB(dbName, storeName, keys, callback) {
        function openDatabase(upgrade) {
            const dbRequest = upgrade ? indexedDB.open(dbName, upgrade) : indexedDB.open(dbName);

            dbRequest.onerror = function (event) {
                callback(event);
            }

            dbRequest.onupgradeneeded = function (event) {
                const database = event.target.result;

                database.onerror = function (event) {
                    callback(event);
                    database.close();
                }

                database.onversionchange = function (event) {
                    database.close();
                }

                if (!keys) return;

                function getStore() {
                    if (database.objectStoreNames.contains(storeName)) {
                        return event.currentTarget.transaction.objectStore(storeName);
                    } else {
                        return database.createObjectStore(storeName, { keyPath: "_id", autoIncrement: true });
                    }
                }

                const objectStore = getStore();
                const differentKeys = difference(keys, [...objectStore.indexNames]);

                differentKeys[0].forEach(element => {
                    // if (element === '_id') return;
                    objectStore.createIndex(element, element, { unique: false, multiEntry: true });
                });

                differentKeys[1].forEach(element => {
                    // if (element === '_id') return;
                    objectStore.deleteIndex(element);
                });
            }

            dbRequest.onsuccess = function (event) {
                const database = event.target.result;

                if (!database.objectStoreNames.contains(storeName)) {
                    if (keys) {
                        database.close();
                        return openDatabase(database.version + 1);
                    } else {
                        database.close();
                        return callback(Error('Store ' + storeName + ' not exist'));
                    }
                }

                callback(null, database);
            }
        }

        openDatabase();
    }

    function getCollector() {
        return {
            setItem: {
                buffer: [],
                writing: false,
                next: () => {
                    collector.setItem.writing = false;
                    if (collector.setItem.buffer.length > 0) setItem(...collector.setItem.buffer.shift());
                }
            },
            setItems: {
                buffer: [],
                writing: false,
                next: () => {
                    collector.setItems.writing = false;
                    if (collector.setItems.buffer.length > 0) setItems(...collector.setItems.buffer.shift());
                }
            },
            getItems: {
                buffer: [],
                reading: false,
                next: () => {
                    collector.getItems.reading = false;
                    if (collector.getItems.buffer.length > 0) getItems(...collector.getItems.buffer.shift());
                }
            }
        }
    }

    const collector = getCollector();

    const cache = {
        data: {},
        hashes: {},
        hash: (data) => ("0000000" + (JSON.stringify(data).split('').map(v => v.charCodeAt(0)).reduce((a, v) => a + ((a << 7) + (a << 3)) ^ v) >>> 0).toString(16)).substr(-8),
        get: (hash) => {
            return cache.hashes[hash] ? cache.hashes[hash].map((id) => Object.assign({}, cache.data[id])) : null;
        },
        getById: (id) => {
            return cache.data[id] ? [Object.assign({}, cache.data[id])] : null;
        },
        set: (hash, result) => {
            // result.forEach((item) => cache.data[item._id] = item);
            cache.hashes[hash] = [];
            for (let i = 0; i < result.length; i++) {
                cache.data[result[i]._id] = Object.assign({}, result[i]);
                cache.hashes[hash][i] = result[i]._id;
            }
        },
        setById: (objects) => {
            cache.hashes = {};
            for (let object of objects) {
                if (object._id) cache.data[object._id] = Object.assign({}, object);
            }
        },
        delete: (id) => {
            delete cache.data[id];
            for (const hash of Object.keys(cache.hashes)) cache.hashes[hash] = cache.hashes[hash].filter((cachedId) => cachedId !== id);
        }
    }

    function setItem(dbName, storeName, object, callback, options = { bufferlock: false, updatelock: false, origin: false }) {
        if (!callback) return new Promise((resolve) => setItem(dbName, storeName, object, (error, result) => resolve({ error, result }), options));

        if (thread === 'main' && worker) return workerBridge('setItem', arguments, (error, result) => {
            if (result && result._id && !cachelock.includes(storeName)) cache.setById([result]);
            callback(error, result);
        });

        if (collector.setItem.writing) {
            return collector.setItem.buffer.push(arguments);
        } else {
            collector.setItem.writing = true;
        }

        openIndexedDB(dbName, storeName, Object.keys(object), (error, database) => {
            if (error) return callback(error), collector.setItem.next();
            const transaction = database.transaction([storeName], 'readwrite');
            const objectStore = transaction.objectStore(storeName);
            object = objectConverter(object);
            if (!object._id) object._id = objectId();
            if (!object.origin && options.origin === true) object.origin = object._id;
            if (!object.timestamp) object.timestamp = Date.now();
            const objectRequest = !options.updatelock ? objectStore.put(object) : objectStore.add(object);

            objectRequest.onerror = function (event) {
                const message = event.target.error.message;
                callback(message);
                database.close();
                collector.setItem.next();
            }

            objectRequest.onsuccess = function (event) {
                if (objectRequest.result === object._id) {
                    let result = objectConverter(object, true);
                    if (thread === 'main' && !cachelock.includes(storeName)) cache.setById([result]);
                    callback(null, result);
                } else {
                    callback(Error('Data saved without result'));
                }

                database.close();
                collector.setItem.next();
            }

            if (buffer.includes(storeName) && !options.bufferlock) setItem(dbName, 'buffer', object, function (error, result) {
                // console.log('[Buffer] setItem:', error, result);
            });
        });
    }

    function setItems(dbName, storeName, objects, callback, options = { bufferlock: false, updatelock: false }) {
        if (!callback) return new Promise((resolve) => setItems(dbName, storeName, objects, (error, result) => resolve({ error, result }), options));

        if (thread === 'main' && worker) return workerBridge('setItems', arguments, (error, results) => {
            if (results && results.length && !cachelock.includes(storeName)) cache.setById(results);
            callback(error, results);
        });

        if (collector.setItems.writing) {
            return collector.setItems.buffer.push(arguments);
        } else {
            collector.setItems.writing = true;
        }

        openIndexedDB(dbName, storeName, Object.keys(objects[0]), (error, database) => {
            if (error) return callback(error), collector.setItems.next();
            const transaction = database.transaction([storeName], 'readwrite');
            const objectStore = transaction.objectStore(storeName);

            for (let object of objects) {
                object = objectConverter(object);
                if (!object._id) object._id = objectId();
                if (!object.timestamp) object.timestamp = Date.now();
                const objectStoreRequest = !options.updatelock ? objectStore.put(object) : objectStore.add(object);
                objectStoreRequest.onerror = (event) => {
                    event.preventDefault();
                }
            }

            transaction.onerror = function (event) {
                const message = event.target.error.message;
                if (message.includes('already exists')) return;
                callback(message);
                database.close();
                collector.setItems.next();
            }

            transaction.oncomplete = function (event) {
                let results = objects.map((object) => objectConverter(object, true));
                if (thread === 'main' && !cachelock.includes(storeName)) cache.setById(results);
                callback(null, results);
                database.close();
                collector.setItems.next();
            }

            if (buffer.includes(storeName) && !options.bufferlock) setItems(dbName, 'buffer', objects, function (error, result) {
                // console.log('[Buffer] setItems:', error, result);
            });
        });
    }

    function getItem(dbName, storeName, id, callback) {
        if (!callback) return new Promise((resolve) => getItem(dbName, storeName, id, (error, result) => resolve({ error, result })));

        const cached = {};
        if (thread === 'main') {
            if (!cachelock.includes(storeName)) {
                cached.hash = cache.hash([dbName, storeName, id]);
                cached.results = cache.get(cached.hash) || (typeof id === 'string') ? cache.getById(id) : null;
                if (cached.results && cached.results[0]) callback(null, cached.results[0]);
            }

            if (worker) {
                return workerBridge('getItem', arguments, (error, result) => {
                    if (!cached.results || !cached.results[0]) callback(error, result);
                    if (!cachelock.includes(storeName)) cache.set(cached.hash, [result]);
                });
            }
        }

        openIndexedDB(dbName, storeName, null, (error, database) => {
            if (error) return callback(error);
            const transaction = database.transaction([storeName]);
            const objectStore = transaction.objectStore(storeName);

            if (typeof id === 'string') {
                const objectRequest = objectStore.get(id);

                objectRequest.onerror = function (event) {
                    callback(event);
                    database.close();
                }

                objectRequest.onsuccess = function (event) {
                    let result = objectConverter(objectRequest.result, true);
                    if (!cached.results || !cached.results[0]) callback(null, result);
                    if (thread === 'main' && !cachelock.includes(storeName)) cache.set(cached.hash, [result]);
                    database.close();
                }
            } else {
                const names = objectStore.indexNames;
                const index = names.contains('timestamp') ? objectStore.index('timestamp') : null;
                const openCursorRequest = index ? index.openKeyCursor(null, 'prev') : objectStore.openKeyCursor(null, 'prev');

                openCursorRequest.onerror = () => {
                    callback(event);
                    database.close();
                }

                openCursorRequest.onsuccess = () => {
                    const objectRequest = objectStore.get(openCursorRequest.result.primaryKey);

                    objectRequest.onerror = function (event) {
                        callback(event);
                        database.close();
                    }

                    objectRequest.onsuccess = function (event) {
                        let result = objectConverter(objectRequest.result, true);
                        if (!cached.results || !cached.results[0]) callback(null, result);
                        if (thread === 'main' && !cachelock.includes(storeName)) cache.set(cached.hash, [result]);
                        database.close();
                    }
                }
            }
        });
    }

    function getItems(dbName, storeName, object, callback, options = { unique: false }) {
        if (!callback) return new Promise((resolve) => getItems(dbName, storeName, object, (error, result) => resolve({ error, result }), options));

        const cached = {};
        if (thread === 'main') {
            if (!cachelock.includes(storeName)) {
                cached.hash = cache.hash([dbName, storeName, object, options]);
                cached.results = cache.get(cached.hash);
                if (cached.results) callback(null, cached.results);
            }

            if (worker) {
                return workerBridge('getItems', arguments, (error, results) => {
                    if (!cached.results) callback(error, results);
                    if (!cachelock.includes(storeName)) cache.set(cached.hash, results);
                });
            }
        }

        // if (collector.getItems.reading) {
        //     return collector.getItems.buffer.push(arguments);
        // } else {
        //     collector.getItems.reading = true;
        // }

        openIndexedDB(dbName, storeName, null, (error, database) => {
            if (error) return callback(error);
            // if (error) return callback(error), collector.getItems.next();
            const transaction = database.transaction([storeName]);
            const objectStore = transaction.objectStore(storeName);
            object = objectConverter(object);
            const items = Object.entries(object);

            const success = (results) => {
                if (options.unique && options.unique.length) {
                    if (typeof options.unique === 'string') options.unique = [options.unique];
                    for (let key of options.unique) {
                        let unique = {};
                        for (let result of results) {
                            unique[result[key]] = result;
                        }
                        results = Object.values(unique);
                    }
                }

                results.sort((a, b) => b.timestamp - a.timestamp);
                results = results.map((element) => objectConverter(element, true));
                if (!cached.results) callback(null, results);
                if (thread === 'main' && !cachelock.includes(storeName)) cache.set(cached.hash, results);
                database.close();
                // collector.getItems.next();
            }

            if (items.length === 0) {
                const objectRequest = objectStore.getAll();
                objectRequest.onerror = function (event) {
                    callback(event);
                    database.close();
                    // collector.getItems.next();
                }

                objectRequest.onsuccess = function (event) {
                    success(event.target.result);
                }

                return;
            }

            const checkValue = (value) => {
                for (const item of items) {
                    if (value[item[0]] == item[1]) continue;
                    if (Array.isArray(value[item[0]]) && (value[item[0]].includes(item[1]))) continue;
                    if (typeof item[1] !== 'object') return false;
                    if (!item[1].lower || !item[1].upper) return false;
                    if (item[1].lowerOpen && value[item[0]] <= item[1].lower) return false;
                    if (!item[1].lowerOpen && value[item[0]] < item[1].lower) return false;
                    if (item[1].upperOpen && value[item[0]] >= item[1].upper) return false;
                    if (!item[1].upperOpen && value[item[0]] > item[1].upper) return false;
                }
                return true;
            }

            const allowedTypes = ['number', 'date', 'string', 'binary', 'array', 'object'];

            const target = (() => {
                for (let i = 0; i < items.length; i++) {
                    if (objectStore.indexNames.contains(items[i][0])) return i;
                }
            })();

            const index = objectStore.index(items[target][0]);
            const objectRequest = allowedTypes.some((element) => element === typeof items[target][1]) ? index.getAll(items[target][1]) : index.getAll();

            objectRequest.onerror = function (event) {
                callback(event);
                database.close();
                // collector.getItems.next();
            }

            objectRequest.onsuccess = function (event) {
                // success(objectRequest.result);
                success(objectRequest.result.filter((value) => checkValue(value)));
            }
        });
    }

    function deleteItem(dbName, storeName, id, callback) {
        if (!callback) return new Promise((resolve) => deleteItem(dbName, storeName, id, (error, result) => resolve({ error, result })));

        if (thread === 'main' && worker) return workerBridge('deleteItem', arguments, (error, result) => {
            if (result && !cachelock.includes(storeName)) cache.delete(result);
            callback(error, result);
        });

        openIndexedDB(dbName, storeName, null, (error, database) => {
            if (error) return callback(error);
            const transaction = database.transaction([storeName], 'readwrite');
            const objectStore = transaction.objectStore(storeName);
            const objectRequest = objectStore.delete(id);

            objectRequest.onerror = function (event) {
                callback(event);
                database.close();
            }

            objectRequest.onsuccess = function (event) {
                if (thread === 'main' && !cachelock.includes(storeName)) cache.delete(id);
                callback(null, id);
                database.close();
            }
        });
    }

    function clearStore(dbName, storeName, options, callback) {
        if (thread === 'main' && worker) return workerBridge('clearStore', arguments, (error, result) => callback(error, result));
        openIndexedDB(dbName, storeName, null, (error, database) => {
            if (error) return callback(error);
            const transaction = database.transaction([storeName], 'readwrite');
            const objectStore = transaction.objectStore(storeName);
            const objectRequest = objectStore.clear();

            objectRequest.onerror = function (event) {
                callback(event);
                database.close();
            }

            objectRequest.onsuccess = function (event) {
                callback(null, true);
                database.close();
            }
        });
    }

    function init(dbName, stores, initCallback) {
        if (stores) {
            initIndexedDB(dbName, stores, (error, database, upgrade) => {
                initCallback(error, database, upgrade, (worker ? true : false));
            });
        } else {
            return callback(Error('Set stores to init database'));
        }

        const update = function (storeName) {
            return function (object, update = { $set: {} }, options = { upsert: true }, callback) {
                object = Object.assign({}, object);
                if (object._id) {
                    getItem(dbName, storeName, object._id, function (error, document) {
                        if (error && callback) return callback(error);
                        if (!document || !Object.keys(document).length) document = object;

                        if (update.$set) {
                            Object.keys(update.$set).forEach(key => {
                                if (document._id && key === '_id') return;
                                document[key] = update.$set[key];
                            });
                        }

                        if (update.$addToSet) {
                            Object.keys(update.$addToSet).forEach(key => {
                                if (document[key] && Array.isArray(document[key])) {
                                    if (!JSON.stringify(document[key]).includes(JSON.stringify(update.$addToSet[key]))) document[key].push(update.$addToSet[key]);
                                } else {
                                    document[key] = [update.$addToSet[key]];
                                }
                            });
                        }

                        if (update.$pull) {
                            Object.keys(update.$pull).forEach(key => {
                                if (document[key] && Array.isArray(document[key])) {
                                    document[key].forEach((element, index) => {
                                        if (JSON.stringify(element).includes(JSON.stringify(update.$pull[key]))) delete document[key][index];
                                        //if (JSON.stringify(element).includes(JSON.stringify(update.$pull[key]))) document[key].splice(index, 1);
                                    });
                                    document[key] = document[key].filter(item => item);
                                }
                            });
                        }

                        setItem(dbName, storeName, document, function (error, result) {
                            if (callback) callback(error, 1, options.upsert, result);
                        });
                    });
                } else {
                    getItems(dbName, storeName, object, function (error, documents) {
                        if (error && callback) return callback(error);
                        if (!documents[0] || !Object.keys(documents[0]).length) documents[0] = object;

                        if (update.$set) {
                            documents[0].timestamp = Date.now();
                            Object.keys(update.$set).forEach(key => {
                                if (documents[0]._id && key === '_id') return;
                                documents[0][key] = update.$set[key];
                            });
                        }

                        if (update.$addToSet) {
                            Object.keys(update.$addToSet).forEach(key => {
                                if (documents[0][key] && Array.isArray(documents[0][key])) {
                                    if (!JSON.stringify(documents[0][key]).includes(JSON.stringify(update.$addToSet[key]))) documents[0][key].push(update.$addToSet[key]);
                                } else {
                                    documents[0][key] = [update.$addToSet[key]];
                                }
                            });
                        }

                        if (update.$pull) {
                            Object.keys(update.$pull).forEach(key => {
                                if (documents[0][key] && Array.isArray(documents[0][key])) {
                                    documents[0][key].forEach((element, index) => {
                                        if (JSON.stringify(element).includes(JSON.stringify(update.$pull[key]))) delete documents[0][key][index];
                                        //if (JSON.stringify(element).includes(JSON.stringify(update.$pull[key]))) documents[0][key].splice(index, 1);
                                    });
                                    documents[0][key] = documents[0][key].filter(item => item);
                                }
                            });
                        }

                        setItem(dbName, storeName, documents[0], function (error, result) {
                            if (callback) callback(error, 1, options.upsert, result);
                        });
                    });
                }
            }
        }

        const find = function (storeName) {
            return function (object, callback, options) {
                object = Object.assign({}, object);
                if (hasOperators(object)) {
                    if (object.$or) {
                        let results = [];
                        operatorIteration(0);

                        function operatorIteration(i) {
                            if (object.$or[i]._id) {
                                if (hasOperators(object.$or[i]._id)) {
                                    if (object.$or[i]._id.$in) {
                                        nestedOperatorIteration(0);

                                        function nestedOperatorIteration(x) {
                                            getItem(dbName, storeName, object.$or[i]._id.$in[x], function (error, document) {
                                                results = results.concat(!emptyObject(document) ? [document] : []), x++;
                                                if (x < object.$or[i]._id.$in.length) return nestedOperatorIteration(x);
                                                i++;
                                                if (i < object.$or.length) return operatorIteration(i);
                                                if (callback) callback(error, results);
                                            });
                                        }
                                    }
                                } else {
                                    getItem(dbName, storeName, object.$or[i]._id, function (error, document) {
                                        results = results.concat(!emptyObject(document) ? [document] : []), i++;
                                        if (i < object.$or.length) return operatorIteration(i);
                                        if (callback) callback(error, results);
                                    });
                                }
                            } else {
                                getItems(dbName, storeName, object.$or[i], function (error, documents) {
                                    results = results.concat(documents), i++;
                                    if (i < object.$or.length) return operatorIteration(i);
                                    if (callback) callback(error, results);
                                }, options);
                            }
                        }
                    }
                } else {
                    if (object._id) {
                        if (hasOperators(object._id)) {
                            if (object._id.$in) {
                                let results = [];
                                operatorIteration(0);

                                function operatorIteration(i) {
                                    getItem(dbName, storeName, object._id.$in[i], function (error, document) {
                                        results = results.concat(!emptyObject(document) ? [document] : []), i++;
                                        if (i < object._id.$in.length) return operatorIteration(i);
                                        if (callback) callback(error, results);
                                    });
                                }
                            }
                        } else {
                            getItem(dbName, storeName, object._id, function (error, document) {
                                if (callback) callback(error, !emptyObject(document) ? [document] : []);
                            });
                        }
                    } else if (hasNestedOperators(object)) {
                        const keys = Object.keys(object);
                        let results = [];
                        operatorIteration(0);

                        function operatorIteration(i) {
                            if (hasOperators(object[keys[i]])) {
                                if (object[keys[i]].$in) {
                                    nestedOperatorIteration(0);

                                    function nestedOperatorIteration(x) {
                                        getItems(dbName, storeName, {
                                            [keys[i]]: object[keys[i]].$in[x]
                                        }, function (error, documents) {
                                            results = results.concat(documents), x++;
                                            if (x < object[keys[i]].$in.length) return nestedOperatorIteration(x);
                                            i++;
                                            if (i < keys.length) return operatorIteration(i);
                                            if (callback) callback(error, results);
                                        }, options);
                                    }
                                }
                            } else {
                                getItems(dbName, storeName, {
                                    [keys[i]]: object[keys[i]]
                                }, function (error, documents) {
                                    results = results.concat(documents), i++;
                                    if (i < keys.length) return operatorIteration(i);
                                    if (callback) callback(error, results);
                                }, options);
                            }
                        }
                    } else {
                        getItems(dbName, storeName, object, function (error, documents) {
                            if (callback) callback(error, documents);
                        }, options);
                    }
                }
            }
        }

        const insert = function (storeName) {
            return function (object, callback, options) {
                object = Object.assign({}, object);
                setItem(dbName, storeName, object, function (error, result) {
                    if (callback) callback(error, result);
                }, options);
            }
        }

        const remove = function (storeName) {
            return function (object, options, callback) {
                object = Object.assign({}, object);
                if (Object.keys(object).length === 0 && options.multi === true) {
                    clearStore(dbName, storeName, {}, function (error, result) {
                        if (callback) callback(error, (result ? 1 : 0), result);
                    });
                } else if (object._id) {
                    deleteItem(dbName, storeName, object._id, function (error, result) {
                        if (callback) callback(error, (result ? 1 : 0), result);
                    });
                } else {
                    getItems(dbName, storeName, object, function (error, documents) {
                        if (error && callback) return callback(error);
                        if (documents.length > 0) {
                            if (options.multi === true) {
                                let results = [];
                                for (let i = 0; i < documents.length; i++) {
                                    deleteItem(dbName, storeName, documents[i]._id, function (error, result) {
                                        results.push(result);
                                        if (i === documents.length - 1 && callback) callback(error, results.length, results);
                                    });
                                }
                            } else {
                                deleteItem(dbName, storeName, documents[0]._id, function (error, result) {
                                    if (callback) callback(error, (result ? 1 : 0), result);
                                });
                            }
                        } else {
                            if (callback) callback(null, 0, []);
                        }
                    });
                }
            }
        }

        const methods = {};
        for (const storeName of Object.keys(stores)) {
            methods[storeName] = {
                update: update(storeName),
                find: find(storeName),
                insert: insert(storeName),
                remove: remove(storeName)
            }
        }
        return methods;
    }

    return {
        init: init,
        setItem: setItem,
        setItems: setItems,
        getItem: getItem,
        getItems: getItems,
        deleteItem: deleteItem
    }
};

export default AppDBClient;