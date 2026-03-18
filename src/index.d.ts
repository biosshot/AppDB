// Type definitions for AppDB
// Project: AppDB - IndexedDB wrapper with NeDB-style API
// Definitions by: AppDB Team

export interface AppDBOptions {
    bufferlock?: boolean;
    updatelock?: boolean;
    origin?: boolean;
}

export interface AppDBQueryOptions {
    unique?: string | string[];
}

export interface AppDBUpdateOptions {
    upsert?: boolean;
}

export interface AppDBRemoveOptions {
    multi?: boolean;
}

export interface AppDBError {
    name: string;
    message: string;
}

export type AppDBCallback<T = any> = (error: AppDBError | null, result: T) => void;

export type AppDBUpdateCallback = (
    error: AppDBError | null,
    numReplaced: number,
    upsert: boolean,
    response: any
) => void;

export type AppDBRemoveCallback = (
    error: AppDBError | null,
    numRemoved: number,
    result: any
) => void;

export type AppDBInitCallback = (
    error: AppDBError | null,
    database: IDBDatabase | null,
    upgrade: number | undefined,
    isWorker: boolean
) => void;

// Query Operators
export interface AppDBQueryOperators {
    $in?: any[];
    $bound?: [any, any];
    $gt?: any;
    $lt?: any;
    $gte?: any;
    $lte?: any;
    $or?: AppDBQueryObject[];
}

export interface AppDBQueryObject {
    [key: string]: any | AppDBQueryOperators;
    _id?: string | AppDBQueryOperators;
}

// Update Operators
export interface AppDBUpdateObject {
    $set?: { [key: string]: any };
    $addToSet?: { [key: string]: any };
    $pull?: { [key: string]: any };
}

// Document interface
export interface AppDBDocument {
    _id?: string;
    timestamp?: number;
    origin?: string;
    [key: string]: any;
}

// Store methods interface
export interface AppDBStore<T extends AppDBDocument = AppDBDocument> {
    /**
     * Insert a new document into the store
     */
    insert(object: T, callback?: AppDBCallback<T>): Promise<T>;
    insert(object: T, callback: AppDBCallback<T>, options?: AppDBOptions): void;

    /**
     * Find documents matching the query
     */
    find(object: AppDBQueryObject, callback?: AppDBCallback<T[]>): Promise<T[]>;
    find(object: AppDBQueryObject, callback: AppDBCallback<T[]>, options?: AppDBQueryOptions): void;

    /**
     * Update documents matching the query
     */
    update(
        query: AppDBQueryObject,
        updateObject: AppDBUpdateObject,
        options?: AppDBUpdateOptions,
        callback?: AppDBUpdateCallback
    ): Promise<{
        numReplaced: number,
        upsert: boolean,
        response: any
    }>;

    /**
     * Remove documents matching the query
     */
    remove(query: AppDBQueryObject, options?: AppDBRemoveOptions, callback?: AppDBRemoveCallback): Promise<number>;
}

// Database stores map
export interface AppDBStoresMap {
    [storeName: string]: string[];
}

// Main AppDB Client interface
export interface AppDBClientInstance {
    /**
     * Initialize the database with stores and indexes
     */
    init<T extends AppDBStoresMap>(
        dbName: string,
        stores: T,
        callback: AppDBInitCallback
    ): { [K in keyof T]: AppDBStore };

    init<T extends AppDBStoresMap>(
        dbName: string,
        stores: T,
        callback?: undefined
    ): Promise<{ [K in keyof T]: AppDBStore }>;

    clearStore(
        dbName: string,
        storeName: string,
        callback: AppDBCallback<boolean>
    ): void

    clearStore(
        dbName: string,
        storeName: string,
        callback?: undefined
    ): Promise<boolean>

    /**
     * Insert or update a single item
     */
    setItem<T = any>(
        dbName: string,
        storeName: string,
        object: T,
        callback: AppDBCallback<T & AppDBDocument>,
        options?: AppDBOptions
    ): void;

    setItem<T = any>(
        dbName: string,
        storeName: string,
        object: T,
        callback?: undefined,
        options?: AppDBOptions
    ): Promise<T & AppDBDocument>;


    /**
     * Insert or update multiple items
     */
    setItems<T = any>(
        dbName: string,
        storeName: string,
        objects: T[],
        callback: AppDBCallback<T[]>,
        options?: AppDBOptions
    ): void;

    setItems<T = any>(
        dbName: string,
        storeName: string,
        objects: T[],
        callback?: undefined,
        options?: AppDBOptions
    ): Promise<T[]>;

    /**
     * Get a single item by ID
     */
    getItem<T = any>(
        dbName: string,
        storeName: string,
        id: string | null,
        callback: AppDBCallback<T>
    ): void;

    getItem<T = any>(
        dbName: string,
        storeName: string,
        id: string | null,
        callback?: undefined
    ): Promise<T>;

    /**
     * Get multiple items matching the query
     */
    getItems<T = any>(
        dbName: string,
        storeName: string,
        object: AppDBQueryObject,
        callback: AppDBCallback<T[]>,
        options?: AppDBQueryOptions
    ): void;

    getItems<T = any>(
        dbName: string,
        storeName: string,
        object: AppDBQueryObject,
        callback?: undefined,
        options?: AppDBQueryOptions
    ): Promise<T[]>;

    /**
     * Delete an item by ID
     */
    deleteItem(
        dbName: string,
        storeName: string,
        id: string,
        callback: AppDBCallback<string>
    ): void;

    deleteItem(
        dbName: string,
        storeName: string,
        id: string,
        callback?: undefined
    ): Promise<string>;
}

// Constructor type
export interface AppDBClientConstructor {
    new(inWorker: true, buffer?: string[], cachelock?: string[]): AppDBClientInstance;
    new(inWorker: false, buffer?: string[], cachelock?: string[], customIndexedDb?: { indexedDB: unknown, IDBKeyRange: unknown }): AppDBClientInstance;
}

// Export the main class
export const AppDBClient: AppDBClientConstructor;

// Default export
export default AppDBClient;

// Global declaration for script tag usage
declare global {
    interface Window {
        AppDBClient: AppDBClientConstructor;
    }
}