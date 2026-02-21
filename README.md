
# AppDB

**AppDB** is a lightweight embedded database for JavaScript applications running in the browser, built on top of **IndexedDB**. It provides an API similar to **NeDB** and **MongoDB**, making it easy to learn for developers familiar with these tools.

AppDB supports execution in both the **main thread** and **Web Workers**, allowing heavy database operations to be performed without blocking the user interface.

## Features

* **IndexedDB Backend:** Reliable client-side storage supporting large volumes of data.
* **NeDB/MongoDB-style API:** Methods include `insert`, `find`, `update`, `remove`.
* **Web Worker Support:** Offload database operations to a separate thread for better performance.
* **Automatic Indexing:** Indexes are created dynamically based on used keys.
* **Caching:** Built-in caching layer to speed up frequent queries.
* **Flexible Queries:** Supports operators like `$set`, `$addToSet`, `$pull`, `$or`, `$in`, `$bound`, etc.
* **Asynchronous:** Full support for Callbacks and Promises.
* **ID Generation:** Automatic unique identifier (`_id`) generation.

## Installation

Include the `AppDB.js` file in your project:

```html
<script src="AppDB.js"></script>
```

Or import as a module (depending on your build setup):

```javascript
import AppDBClient from './AppDB.js';
```

## Quick Start

### Initialization

To get started, initialize the database by defining store names and their indexes.

```javascript
// Initialize client (false = main thread, [] = buffer stores, [] = cache locked stores)
const AppDB = new AppDBClient(false, [], []); 

const db = AppDB.init('MyDatabase', {
    projects: ['mission', 'project', 'timestamp'],
    missions: ['status', 'timestamp'],
    users: ['email']
}, function (error, database, upgrade, isWorker) {
    if (error) return console.error(error);
    console.log('Database initialized');
  
    // Example insert
    db.projects.insert({
        mission: 'bla1',
        project: 'super1',
        status: 'active'
    }, function (err, newDoc) {
        console.log('Document added:', newDoc);
    });
});
```

### Basic Operations (CRUD)

#### Insert

```javascript
db.projects.insert({ name: 'New Project', value: 100 }, function (err, doc) {
    if (err) return console.error(err);
    console.log('Document ID:', doc._id);
});
```

#### Find

```javascript
// Find all projects with mission 'bla1'
db.projects.find({ mission: 'bla1' }, function (err, docs) {
    console.log('Documents found:', docs.length);
});

// Find by ID
db.projects.find({ _id: 'ac0e7ogbcp8o1ksi7jwv0x1' }, function (err, docs) {
    console.log('Document:', docs[0]);
});

// Using operators ($in, $or)
db.projects.find({
    $or: [
        { mission: 'bla1' },
        { mission: 'bla2' }
    ]
}, function (err, docs) {
    console.log('$or result:', docs);
});

// Range search ($bound)
db.projects.find({
    timestamp: { $bound: [0, 1679322855220] }
}, function (err, docs) {
    console.log('Documents in range:', docs);
});
```

#### Update

```javascript
db.projects.update(
    { _id: 'ac0e7ogbcp8o1ksi7jwv0x1' }, // Query
    {
        $set: { status: 'completed' },
        $addToSet: { tags: 'important' },
        $pull: { tags: 'obsolete' }
    }, // Update
    { upsert: true }, // Options
    function (err, numReplaced, upsert, response) {
        console.log('Updated:', numReplaced);
    }
);
```

#### Remove

```javascript
// Remove one document
db.projects.remove({ _id: 'ac0e7ogbcp8o1ksi7jwv0x1' }, {}, function (err, numRemoved) {
    console.log('Removed:', numRemoved);
});

// Remove multiple documents
db.projects.remove({ status: 'deleted' }, { multi: true }, function (err, numRemoved) {
    console.log('Multi remove:', numRemoved);
});
```

## Low-level API

If you don't need the ORM-like interface, you can use direct IndexedDB methods:

* `AppDB.setItem(dbName, storeName, object, callback)`
* `AppDB.setItems(dbName, storeName, objects, callback)`
* `AppDB.getItem(dbName, storeName, id, callback)`
* `AppDB.getItems(dbName, storeName, queryObject, callback)`
* `AppDB.deleteItem(dbName, storeName, id, callback)`

```javascript
AppDB.setItem('MyDatabase', 'projects', { name: 'Direct Insert' }, function (err, result) {
    console.log('Saved:', result);
});
```

## Web Workers Support

AppDB supports running database operations inside a Web Worker to prevent blocking the main thread (UI).

```javascript
// Initialize in Worker mode
const AppDB = new AppDBClient(true, [], []); // true = use Worker

// The rest of the API remains the same
const db = AppDB.init('MyDatabase', { ... }, callback);
```

When using a Worker, all requests are passed asynchronously, which is particularly useful when processing large datasets or complex filtering.

## Supported Query Operators

The library supports several operators for flexible filtering:

* **Logical:** `$or`, `$in`
* **Update:** `$set`, `$addToSet`, `$pull`
* **Ranges:** `$bound` (array `[min, max]`), `$gt`, `$lt`, `$gte`, `$lte`
* **Uniqueness:** Option `{ unique: ['fieldName'] }` in the `find` method to deduplicate results.

## Caching & Buffering

### Caching

AppDB has a built-in mechanism to cache query results in memory.

* The cache automatically updates upon insert, update, or delete operations.
* Caching can be disabled for specific stores via the `cachelock` parameter in the constructor.

```javascript
// Disable cache for 'logs' store
const AppDB = new AppDBClient(false, [], ['logs']); 
```

### Buffering

Write operations can be buffered for specific stores to optimize performance.

* Configure via the `buffer` parameter in the constructor.

```javascript
// Enable buffering for 'events' store
const AppDB = new AppDBClient(false, ['events'], []); 
```

## Promises Support

All methods support Promises if a callback is not provided.

```javascript
db.projects.insert({ name: 'Promise Project' })
    .then(({ error, result }) => {
        if (error) throw error;
        console.log('Inserted:', result);
    })
    .catch(console.error);
```

## License

MIT

---

*Note: This library is a wrapper over IndexedDB and is intended for use in modern browsers.*
