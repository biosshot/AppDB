# InDB

**InDB** is a lightweight embedded database for JavaScript that runs in the browser. It uses **IndexedDB** for persistent storage and provides an API similar to **MongoDB** / **NeDB**. The library supports execution in both the main thread and Web Workers for non-blocking operations.

## Features

*   **Storage:** Uses IndexedDB for persistent client-side storage.
*   **MongoDB-like API:** Familiar methods such as `insert`, `find`, `update`, `remove`.
*   **Web Worker Support:** Can offload operations to a Web Worker to avoid blocking the UI (internal Blob worker, no external file needed).
*   **Caching:** Built-in result caching mechanism for faster queries.
*   **Automatic Fields:** Automatically generates `_id` (ObjectId style) and `timestamp`.
*   **Indexing:** Automatic index creation and management based on initialization schema.
*   **Flexibility:** Supports both Callbacks and Promises.
*   **Operators:** Supports update operators (`$set`, `$addToSet`, `$pull`) and query operators (`$or`, `$in`, `$bound`).

## Installation

Include the library via a `<script>` tag or import it as a module.

```html
<script src="InDB-1.1.6.js"></script>
```

Or via ES6 import (if using a bundler):

```javascript
import InDBClient from './InDB-1.1.6.js';
```

## Quick Start

### Initialization

Create a client instance and initialize the database with store definitions and indexes.

```javascript
// Param 1: useWorker (true/false) - Enable Web Worker
// Param 2: buffer - Array of store names to buffer
// Param 3: cachelock - Array of store names to disable caching
const InDB = new InDBClient(false, [], []);

// Initialize DB
// dbName: Database name
// stores: Object { storeName: [indexes] }
const db = InDB.init('MyApplicationDB', {
    projects: ['mission', 'timestamp', 'status'],
    users: ['email', 'role']
}, (err, database, upgrade, isWorker) => {
    if (err) return console.error(err);
    console.log('DB initialized', isWorker ? 'in Worker' : 'in Main Thread');
});
```

### Insert

```javascript
db.projects.insert({
    mission: 'alpha',
    project: 'website',
    status: 'active'
}, (err, newDoc) => {
    console.log('Inserted:', newDoc);
    // newDoc will contain _id and timestamp
});
```

### Find

```javascript
// Find all projects with mission 'alpha'
db.projects.find({ mission: 'alpha' }, (err, docs) => {
    console.log('Found:', docs);
});

// Find by _id
db.projects.find({ _id: 'some_object_id' }, (err, docs) => {
    console.log('Document:', docs[0]);
});

// Using operators ($in, $or)
db.projects.find({
    $or: [
        { mission: 'alpha' },
        { status: 'critical' }
    ]
}, (err, docs) => {
    console.log('Complex query:', docs);
});

// Range query ($bound)
db.projects.find({
    timestamp: { $bound: [startDate, endDate] }
}, (err, docs) => {
    console.log('Time range:', docs);
});
```

### Update

```javascript
// Update document by _id
db.projects.update(
    { _id: 'some_object_id' },
    {
        $set: { status: 'completed' },
        $addToSet: { tags: 'finished' }, // Add to array if not exists
        $pull: { tags: 'pending' }       // Remove from array
    },
    { upsert: true }, // Create if not found
    (err, numReplaced, upsert, newDoc) => {
        console.log('Updated:', newDoc);
    }
);
```

### Remove

```javascript
// Remove one document
db.projects.remove({ _id: 'some_object_id' }, {}, (err, numRemoved) => {
    console.log('Removed count:', numRemoved);
});

// Remove multiple documents (multi)
db.projects.remove({ status: 'deleted' }, { multi: true }, (err, numRemoved) => {
    console.log('Removed count:', numRemoved);
});
```

## Low-level API

If you don't need the MongoDB-style wrapper, you can use the client's direct methods:

*   `InDB.setItem(dbName, storeName, object, callback)`
*   `InDB.setItems(dbName, storeName, objects, callback)`
*   `InDB.getItem(dbName, storeName, id, callback)`
*   `InDB.getItems(dbName, storeName, queryObject, callback)`
*   `InDB.deleteItem(dbName, storeName, id, callback)`
*   `InDB.clearStore(dbName, storeName, options, callback)`

Example with Promise (if no callback is provided):

```javascript
const result = await InDB.getItem('MyApplicationDB', 'projects', 'some_id');
```

## Web Worker Support

To perform operations in a background thread, pass `true` as the first argument to the constructor. The library automatically creates an internal Blob Worker; no external files are required.

```javascript
// Run in Web Worker
const InDB = new InDBClient(true, [], []); 
```

This is recommended for large datasets or complex queries to avoid blocking the main UI thread.

## Supported Operators

### Update Operators
*   `$set`: Sets the value of a field.
*   `$addToSet`: Adds an element to an array only if it does not already exist.
*   `$pull`: Removes elements from an array that match the condition.

### Query Operators
*   `$or`: Logical OR for an array of conditions.
*   `$in`: Checks if a value is included in an array.
*   `$bound`: Range search (for numbers or dates like `timestamp`). Format: `[min, max]`.

## Query Options

*   `unique`: Array of fields to uniquify results on the client side.
*   `multi`: (for `remove`) Remove multiple documents or only the first one.
*   `upsert`: (for `update`) Create the document if it is not found.
*   `bufferlock`: (for `setItem`) Prevent buffering for specific operations.
*   `updatelock`: (for `setItem`) Use `add` instead of `put` (fail if exists).

## License

MIT (Based on code structure, please verify with the repository's license file).

---

*InDB is inspired by the NeDB architecture but adapted for modern browsers using IndexedDB and Web Workers.*