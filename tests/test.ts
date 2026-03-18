import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import AppDB from '../src/index.js';

const DB_NAME = 'test-appdb-' + Date.now();
const STORES = {
    users: ['name', 'email', 'age'],
    posts: ['title', 'userId', 'tags']
};

const db = new AppDB(false, [], [], { indexedDB, IDBKeyRange });

describe('AppDB', () => {
    before(async () => {
        // Initialize with fake-indexeddb provider
        await db.init(DB_NAME, STORES);
    });

    after(() => {
        // Clean up test database
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => { };
        process.exit()
    });

    describe('setItem / getItem', () => {
        it('should create and retrieve a record', async () => {
            const user = { name: 'John', email: 'john@example.com', age: 25 };
            const result = await db.setItem(DB_NAME, 'users', user);

            assert.ok(result._id, 'should return _id');
            assert.ok(result.timestamp, 'should return timestamp');
            assert.strictEqual(result.name, 'John');

            const retrieved = await db.getItem(DB_NAME, 'users', result._id);
            assert.strictEqual(retrieved.name, 'John');
            assert.strictEqual(retrieved.email, 'john@example.com');
        });

        it('should update an existing record', async () => {
            const user = { name: 'Jane', email: 'jane@example.com', age: 30 };
            const created = await db.setItem(DB_NAME, 'users', user);

            const updated = await db.setItem(DB_NAME, 'users', {
                _id: created._id,
                name: 'Jane Updated',
                age: 31
            });

            assert.strictEqual(updated.name, 'Jane Updated');
            assert.strictEqual(updated._id, created._id);
        });

        it('should retrieve the latest record when passing null as id', async () => {
            await db.setItem(DB_NAME, 'users', { name: 'Last', email: 'last@example.com', age: 20 });
            const last = await db.getItem(DB_NAME, 'users', null);

            assert.ok(last);
            assert.ok(last.timestamp);
        });
    });

    describe('setItems', () => {
        it('should create multiple records', async () => {
            const users = [
                { name: 'User1', email: 'user1@example.com', age: 22 },
                { name: 'User2', email: 'user2@example.com', age: 23 },
                { name: 'User3', email: 'user3@example.com', age: 24 }
            ];

            const results = await db.setItems(DB_NAME, 'users', users);

            assert.strictEqual(results.length, 3);

            results.forEach((result, index) => {
                assert.strictEqual(result.name, users[index].name);
            });
        });
    });

    describe('getItems', () => {
        it('should retrieve all records', async () => {
            const results = await db.getItems(DB_NAME, 'users', {});
            assert.ok(Array.isArray(results));
            assert.ok(results.length >= 3);
        });

        it('should filter records by field', async () => {
            const results = await db.getItems(DB_NAME, 'users', { name: 'John' });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].name, 'John');
        });

        it('should sort by timestamp (newest first)', async () => {
            const results = await db.getItems(DB_NAME, 'users', {});
            for (let i = 1; i < results.length; i++) {
                assert.ok(results[i - 1].timestamp >= results[i].timestamp);
            }
        });
    });

    describe('deleteItem', () => {
        it('should delete a record by id', async () => {
            const user = await db.setItem(DB_NAME, 'users', { name: 'ToDelete', email: 'delete@example.com' });
            const deleted = await db.deleteItem(DB_NAME, 'users', user._id!);

            assert.strictEqual(deleted, user._id);

            const retrieved = await db.getItem(DB_NAME, 'users', user._id!);

            assert.strictEqual(retrieved, undefined);
        });
    });

    describe('init with store methods', () => {
        let usersStore: any;
        let postsStore: any;

        before(async () => {
            const stores = await db.init(DB_NAME + '-stores', {
                users: ['name', 'email'],
                posts: ['title', 'userId']
            });

            usersStore = stores.users;
            postsStore = stores.posts;
        });

        describe('insert', () => {
            it('should insert a record', async () => {
                const result = await usersStore.insert({ name: 'InsertTest', email: 'insert@example.com' });
                assert.ok(result._id);
                assert.strictEqual(result.name, 'InsertTest');
            });
        });

        describe('find', () => {
            before(async () => {
                await usersStore.insert({ name: 'FindTest1', email: 'find1@example.com' });
                await usersStore.insert({ name: 'FindTest2', email: 'find2@example.com' });
                await usersStore.insert({ name: 'FindTest1', email: 'find3@example.com' });
            });

            it('should find a record by _id', async () => {
                const created = await usersStore.insert({ name: 'ById', email: 'byid@example.com' });
                const results = await usersStore.find({ _id: created._id });

                assert.strictEqual(results.length, 1);
                assert.strictEqual(results[0].name, 'ById');
            });

            it('should find records by field', async () => {
                const results = await usersStore.find({ name: 'FindTest1' });
                assert.ok(results.length >= 2);
            });

            it('should support $in operator', async () => {
                const created1 = await usersStore.insert({ name: 'InTest1', email: 'in1@example.com' });
                const created2 = await usersStore.insert({ name: 'InTest2', email: 'in2@example.com' });

                const results = await usersStore.find({ _id: { $in: [created1._id, created2._id] } });
                assert.strictEqual(results.length, 2);
            });

            it('should support $or operator', async () => {
                const results = await usersStore.find({
                    $or: [
                        { name: 'FindTest1' },
                        { name: 'FindTest2' }
                    ]
                });
                assert.ok(results.length >= 3);
            });
        });

        describe('update', () => {
            it('should update a record ($set)', async () => {
                const created = await usersStore.insert({ name: 'UpdateTest', email: 'update@example.com' });

                const result = await usersStore.update(
                    { _id: created._id },
                    { $set: { name: 'UpdatedName' } }
                );

                assert.strictEqual(result.numReplaced, 1);

                const updated = await usersStore.find({ _id: created._id });
                assert.strictEqual(updated[0].name, 'UpdatedName');
            });

            it('should update with upsert', async () => {
                const result = await usersStore.update(
                    { name: 'NonExistent' },
                    { $set: { name: 'NonExistent', email: 'new@example.com' } },
                    { upsert: true }
                );

                assert.strictEqual(result.numReplaced, 1);
                assert.ok(result.upsert);
            });
        });

        describe('remove', () => {
            it('should remove a single record', async () => {
                const created = await usersStore.insert({ name: 'RemoveOne', email: 'remove1@example.com' });

                const result = await usersStore.remove({ _id: created._id });
                assert.strictEqual(result, 1);

                const found = await usersStore.find({ _id: created._id });
                assert.strictEqual(found.length, 0);

            });

            it('should remove multiple records (multi: true)', async () => {
                await usersStore.insert({ name: 'RemoveMulti', email: 'rm1@example.com' });
                await usersStore.insert({ name: 'RemoveMulti', email: 'rm2@example.com' });

                const result = await usersStore.remove({ name: 'RemoveMulti' }, { multi: true });
                assert.ok(result >= 2);

                const found = await usersStore.find({ name: 'RemoveMulti' });
                assert.strictEqual(found.length, 0);
            });
        });
    });

    describe('caching', () => {
        it('should cache getItem results', async () => {
            const user = await db.setItem(DB_NAME, 'users', { name: 'CacheTest', email: 'cache@example.com' });

            // First request - from DB
            const result1 = await db.getItem(DB_NAME, 'users', user._id!);
            assert.strictEqual(result1.name, 'CacheTest');

            // Second request - from cache
            const result2 = await db.getItem(DB_NAME, 'users', user._id!);
            assert.strictEqual(result2.name, 'CacheTest');
        });
    });

    describe('Promise / callback API', () => {
        it('should work with callback for setItem', (ctx, done) => {
            db.setItem(DB_NAME, 'users', { name: 'CallbackTest', email: 'callback@example.com' }, (err, result) => {
                assert.ifError(err);
                assert.ok(result._id!);
                done();
            });
        });

        it('should work with callback for getItem', async () => {
            const user = await db.setItem(DB_NAME, 'users', { name: 'CallbackGet', email: 'cbget@example.com' });

            await new Promise<void>((resolve, reject) => {
                db.getItem(DB_NAME, 'users', user._id!, (err, result) => {
                    if (err) return reject(err);
                    assert.strictEqual(result.name, 'CallbackGet');
                    resolve();
                });
            });
        });
    });

    describe('update operators', () => {
        let localPostsStore: any;

        before(async () => {
            const stores = await db.init(DB_NAME + '-ops', {
                posts: ['title', 'userId', 'tags']
            });
            localPostsStore = stores.posts;
        });

        it('should use $addToSet', async () => {
            const post = await localPostsStore.insert({ title: 'Post', userId: 1, tags: ['tag1'] });

            await localPostsStore.update(
                { _id: post._id },
                { $addToSet: { tags: 'tag2' } }
            );

            const updated = await localPostsStore.find({ _id: post._id });
            assert.ok(updated[0].tags.includes('tag1'));
            assert.ok(updated[0].tags.includes('tag2'));
        });

        it('should use $pull', async () => {
            const post = await localPostsStore.insert({ title: 'Post2', userId: 1, tags: ['tag1', 'tag2', 'tag3'] });

            await localPostsStore.update(
                { _id: post._id },
                { $pull: { tags: 'tag2' } }
            );

            const updated = await localPostsStore.find({ _id: post._id });
            assert.ok(updated[0].tags.includes('tag1'));
            assert.ok(!updated[0].tags.includes('tag2'));
            assert.ok(updated[0].tags.includes('tag3'));
        });

        it('should not duplicate elements with $addToSet', async () => {
            const post = await localPostsStore.insert({ title: 'Post3', userId: 1, tags: ['tag1'] });

            await localPostsStore.update(
                { _id: post._id },
                { $addToSet: { tags: 'tag1' } }
            );

            const updated = await localPostsStore.find({ _id: post._id });
            assert.strictEqual(updated[0].tags.length, 1);
            assert.strictEqual(updated[0].tags[0], 'tag1');
        });
    });

    describe('clearStore', () => {
        it('should clear the entire store', async () => {
            const stores = await db.init(DB_NAME + '-clear', {
                temp: ['value']
            });
            const tempStore = stores.temp;

            await tempStore.insert({ value: 'test1' });
            await tempStore.insert({ value: 'test2' });
            await tempStore.insert({ value: 'test3' });

            const allBefore = await tempStore.find({});
            assert.ok(allBefore.length >= 3);

            await db.clearStore(DB_NAME + '-clear', 'temp');
            const allAfter = await tempStore.find({});
            assert.strictEqual(allAfter.length, 0);
        });
    });

    describe('unique option in getItems', () => {
        it('should apply unique option for a single field', async () => {
            const stores = await db.init(DB_NAME + '-unique', {
                items: ['name', 'category']
            });
            const itemsStore = stores.items;

            await itemsStore.insert({ name: 'Item1', category: 'A' });
            await itemsStore.insert({ name: 'Item2', category: 'A' });
            await itemsStore.insert({ name: 'Item3', category: 'B' });

            const results = await db.getItems(DB_NAME + '-unique', 'items', {}, undefined, { unique: 'category' });
            const categories = results.map((r: any) => r.category);
            assert.strictEqual(new Set(categories).size, categories.length);
        });

        it('should apply unique option for multiple fields', async () => {
            const stores = await db.init(DB_NAME + '-unique2', {
                items2: ['name', 'value']
            });
            const itemsStore = stores.items2;

            await itemsStore.insert({ name: 'A', value: 1 });
            await itemsStore.insert({ name: 'A', value: 2 });
            await itemsStore.insert({ name: 'B', value: 1 });

            const results = await db.getItems(DB_NAME + '-unique2', 'items2', {}, undefined, { unique: ['name'] });
            const names = results.map((r: any) => r.name);
            assert.strictEqual(new Set(names).size, names.length);
        });
    });

    describe('error handling', () => {
        it('should return an error for non-existent store', async () => {
            try {
                await db.getItems(DB_NAME, 'nonexistent', {});
                assert.fail('should throw an error');
            } catch (err: any) {
                assert.ok(err.message.includes('not exist') || err.message.includes('not found'));
            }
        });
    });

    describe('different data types', () => {
        it('should save and retrieve numbers', async () => {
            const item = await db.setItem(DB_NAME, 'users', { name: 'NumberTest', age: 42 });
            const retrieved = await db.getItem(DB_NAME, 'users', item._id!);
            assert.strictEqual(retrieved.age, 42);
        });

        it('should save and retrieve boolean values', async () => {
            const item = await db.setItem(DB_NAME, 'users', { name: 'BoolTest', active: true });
            const retrieved = await db.getItem(DB_NAME, 'users', item._id!);
            assert.strictEqual(retrieved.active, true);
        });

        it('should save and retrieve arrays', async () => {
            const item = await db.setItem(DB_NAME, 'posts', { title: 'ArrayTest', tags: ['a', 'b', 'c'] });
            const retrieved = await db.getItem(DB_NAME, 'posts', item._id!);
            assert.deepStrictEqual(retrieved.tags, ['a', 'b', 'c']);
        });

        it('should save and retrieve objects', async () => {
            const metadata = { version: '1.0', author: 'test' };
            const item = await db.setItem(DB_NAME, 'posts', { title: 'ObjectTest', metadata });
            const retrieved = await db.getItem(DB_NAME, 'posts', item._id!);
            assert.deepStrictEqual(retrieved.metadata, metadata);
        });
    });
});
