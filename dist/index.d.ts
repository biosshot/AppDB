// Type definitions for AppDB
// Project: AppDB - IndexedDB wrapper with NeDB-style API
// Definitions by: AppDB Team

interface AppDBOptions {
    bufferlock?: boolean;
    updatelock?: boolean;
    origin?: boolean;
}

interface AppDBQueryOptions {
    unique?: string | string[];
}

interface AppDBUpdateOptions {
    upsert?: boolean;
}

interface AppDBRemoveOptions {
    multi?: boolean;
}

interface AppDBError {
    name: string;
    message: string;
}

interface AppDBResult<T = any> {
    error: AppDBError | null;
    result: T;
}

type AppDBCallback<T = any> = (error: AppDBError | null, result: T) => void;

type AppDBUpdateCallback = (
    error: AppDBError | null,
    numReplaced: number,
    upsert: boolean,
    response: any
) => void;

type AppDBRemoveCallback = (
    error: AppDBError | null,
    numRemoved: number,
    result: any
) => void;

type AppDBInitCallback = (
    error: AppDBError | null,
    database: IDBDatabase | null,
    upgrade: number | undefined,
    isWorker: boolean
) => void;

// Query Operators
interface AppDBQueryOperators {
    $in?: any[];
    $bound?: [any, any];
    $gt?: any;
    $lt?: any;
    $gte?: any;
    $lte?: any;
    $or?: AppDBQueryObject[];
}

interface AppDBQueryObject {
    [key: string]: any | AppDBQueryOperators;
    _id?: string | AppDBQueryOperators;
}

// Update Operators
interface AppDBUpdateObject {
    $set?: { [key: string]: any };
    $addToSet?: { [key: string]: any };
    $pull?: { [key: string]: any };
}

// Document interface
interface AppDBDocument {
    _id?: string;
    timestamp?: number;
    origin?: string;
    [key: string]: any;
}

// Store methods interface
interface AppDBStore<T extends AppDBDocument = AppDBDocument> {
    /**
     * Insert a new document into the store
     */
    insert(object: T, callback?: AppDBCallback<T>): Promise<AppDBResult<T>>;
    insert(object: T, callback: AppDBCallback<T>, options?: AppDBOptions): void;

    /**
     * Find documents matching the query
     */
    find(object: AppDBQueryObject, callback?: AppDBCallback<T[]>): Promise<AppDBResult<T[]>>;
    find(object: AppDBQueryObject, callback: AppDBCallback<T[]>, options?: AppDBQueryOptions): void;

    /**
     * Update documents matching the query
     */
    update(
        query: AppDBQueryObject,
        updateObject: AppDBUpdateObject,
        options?: AppDBUpdateOptions,
        callback?: AppDBUpdateCallback
    ): Promise<AppDBResult<number>>;

    /**
     * Remove documents matching the query
     */
    remove(query: AppDBQueryObject, options?: AppDBRemoveOptions, callback?: AppDBRemoveCallback): Promise<AppDBResult<number>>;
}

// Database stores map
interface AppDBStoresMap {
    [storeName: string]: string[];
}

// Main AppDB Client interface
interface AppDBClientInstance {
    /**
     * Initialize the database with stores and indexes
     */
    init<T extends AppDBStoresMap>(
        dbName: string,
        stores: T,
        callback: AppDBInitCallback
    ): { [K in keyof T]: AppDBStore };

    /**
     * Insert or update a single item
     */
    setItem<T = any>(
        dbName: string,
        storeName: string,
        object: T,
        callback?: AppDBCallback<T>,
        options?: AppDBOptions
    ): Promise<AppDBResult<T>>;

    /**
     * Insert or update multiple items
     */
    setItems<T = any>(
        dbName: string,
        storeName: string,
        objects: T[],
        callback?: AppDBCallback<T[]>,
        options?: AppDBOptions
    ): Promise<AppDBResult<T[]>>;

    /**
     * Get a single item by ID
     */
    getItem<T = any>(
        dbName: string,
        storeName: string,
        id: string | null,
        callback?: AppDBCallback<T>
    ): Promise<AppDBResult<T>>;

    /**
     * Get multiple items matching the query
     */
    getItems<T = any>(
        dbName: string,
        storeName: string,
        object: AppDBQueryObject,
        callback?: AppDBCallback<T[]>,
        options?: AppDBQueryOptions
    ): Promise<AppDBResult<T[]>>;

    /**
     * Delete an item by ID
     */
    deleteItem(
        dbName: string,
        storeName: string,
        id: string,
        callback?: AppDBCallback<string>
    ): Promise<AppDBResult<string>>;
}

// Constructor type
interface AppDBClientConstructor {
    new(inWorker?: boolean, buffer?: string[], cachelock?: string[]): AppDBClientInstance;
}

// Export the main class
declare const AppDBClient: AppDBClientConstructor;


// Global declaration for script tag usage
declare global {
    interface Window {
        AppDBClient: AppDBClientConstructor;
    }
}

export { AppDBClient, AppDBClient as default };
export type { AppDBCallback, AppDBClientConstructor, AppDBClientInstance, AppDBDocument, AppDBError, AppDBInitCallback, AppDBOptions, AppDBQueryObject, AppDBQueryOperators, AppDBQueryOptions, AppDBRemoveCallback, AppDBRemoveOptions, AppDBResult, AppDBStore, AppDBStoresMap, AppDBUpdateCallback, AppDBUpdateObject, AppDBUpdateOptions };
