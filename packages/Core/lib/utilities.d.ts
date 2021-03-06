import { InanoSQLQuery, InanoSQLInstance, TableQueryResult, InanoSQLTable, InanoSQLFunctionResult } from "./interfaces";
export declare const blankTableDefinition: InanoSQLTable;
/**
 * Searches a sorted array for a given value.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {boolean} indexOf
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {number}
 */
export declare const binarySearch: (arr: any[], value: any, indexOf: boolean, startVal?: number | undefined, endVal?: number | undefined) => number;
/**
 * Converts a word to title case.
 *
 * @param {string} str
 * @returns
 */
export declare const titleCase: (str: string) => string;
export declare const slugify: (str: string) => string;
export declare const getWeekOfYear: (d: Date) => number;
export declare const buildQuery: (nSQL: InanoSQLInstance, table: string | any[] | ((where?: any[] | ((row: {
    [key: string]: any;
}, i?: number | undefined) => boolean) | undefined) => Promise<TableQueryResult>), action: string) => InanoSQLQuery;
export declare const adapterFilters: (nSQL: InanoSQLInstance, query?: InanoSQLQuery | undefined) => {
    write: (table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void) => void;
    read: (table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void) => void;
    readMulti: (table: string, type: "all" | "range" | "offset", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void) => void;
    connect: (id: string, complete: () => void, error: (err: any) => void) => void;
    disconnect: (complete: () => void, error: (err: any) => void) => void;
    createTable: (tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) => void;
    dropTable: (table: string, complete: () => void, error: (err: any) => void) => void;
    delete: (table: string, pk: any, complete: () => void, error: (err: any) => void) => void;
    getTableIndex: (table: string, complete: (index: any[]) => void, error: (err: any) => void) => void;
    getTableIndexLength: (table: string, complete: (length: number) => void, error: (err: any) => void) => void;
    createIndex: (table: string, indexName: string, type: string, complete: () => void, error: (err: any) => void) => void;
    deleteIndex: (table: string, indexName: string, complete: () => void, error: (err: any) => void) => void;
    addIndexValue: (table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void) => void;
    deleteIndexValue: (table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void) => void;
    readIndexKey: (table: string, indexName: string, pk: any, onRowPK: (key: any) => void, complete: () => void, error: (err: any) => void) => void;
    readIndexKeys: (table: string, indexName: string, type: "all" | "range" | "offset", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void) => void;
};
export declare const noop: () => void;
export declare const throwErr: (err: any) => never;
export declare const nan: (input: any) => number;
/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
export declare const assign: (obj: any) => any;
/**
 * Compare two javascript variables for equality.
 * Works with primitives, arrays and objects recursively.
 *
 * @param {*} obj1
 * @param {*} obj2
 * @returns {boolean}
 */
export declare const objectsEqual: (obj1: any, obj2: any) => boolean;
export declare class _nanoSQLQueue {
    processItem?: ((item: any, count: number, complete: () => void, error: (err: any) => void) => void) | undefined;
    onError?: ((err: any) => void) | undefined;
    onComplete?: (() => void) | undefined;
    private _items;
    private _going;
    private _done;
    private _count;
    private _triggeredComplete;
    constructor(processItem?: ((item: any, count: number, complete: () => void, error: (err: any) => void) => void) | undefined, onError?: ((err: any) => void) | undefined, onComplete?: (() => void) | undefined);
    private _progressBuffer;
    finished(): void;
    newItem(item: any, processFn?: (item: any, complete: () => void, err?: (error: any) => void) => void): void;
}
/**
 * Quickly and efficiently fire asyncrounous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const chainAsync: (items: any[], callback: (item: any, i: number, next: (value?: any) => void, err: (err?: any) => void) => void) => Promise<any[]>;
/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once all operations are complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, done: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const allAsync: (items: any[], callback: (item: any, i: number, next: (value?: any) => void, err: (err: any) => void) => void) => Promise<any[]>;
export declare const isSafari: boolean;
export declare const isMSBrowser: boolean;
export declare const isAndroid: boolean;
/**
 * Generate a random 16 bit number using strongest entropy/crypto available.
 *
 * @returns {number}
 */
export declare const random16Bits: () => number;
export declare const throttle: (scope: any, func: any, limit: number) => (...args: any[]) => void;
/**
 * Generate a TimeID for use in the database.
 *
 * @param {boolean} [ms]
 * @returns {string}
 */
export declare const timeid: (ms?: boolean | undefined) => string;
/**
 * See if two arrays intersect.
 *
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
export declare const intersect: (arr1: any[], arr2: any[]) => boolean;
/**
 * Generates a valid V4 UUID using the strongest crypto available.
 *
 * @returns {string}
 */
export declare const uuid: () => string;
/**
 * A quick and dirty hashing function, turns a string into a md5 style hash.
 * Stolen from https://github.com/darkskyapp/string-hash
 *
 * @param {string} str
 * @returns {string}
 */
export declare const hash: (str: string) => string;
/**
 * Generate a row ID given the primary key type.
 *
 * @param {string} primaryKeyType
 * @param {number} [incrimentValue]
 * @returns {*}
 */
export declare const generateID: (primaryKeyType: string, incrimentValue?: number | undefined) => any;
/**
 * Clean the arguments from an object given an array of arguments and their types.
 *
 * @param {string[]} argDeclarations
 * @param {StdObject<any>} args
 * @returns {StdObject<any>}
 */
export declare const cleanArgs: (argDeclarations: string[], args: {
    [key: string]: any;
}, nSQL: InanoSQLInstance) => {
    [key: string]: any;
};
/**
 * Determine if a given value is a javascript object or not. Exludes Arrays, Functions, Null, Undefined, etc.
 *
 * @param {*} val
 * @returns {boolean}
 */
export declare const isObject: (val: any) => boolean;
export declare const objSort: (path?: string | undefined, rev?: boolean | undefined) => (a: any, b: any) => number;
/**
 * Recursively resolve function values provided a string and row
 *
 *
 * @param {string} fnString // TRIM(UPPER(column))
 * @param {*} row // {column: " value "}
 * @param {*} prev // aggregate previous value for aggregate functions
 * @returns {InanoSQLFunctionResult}
 * @memberof _nanoSQLQuery
 */
export declare const execFunction: (query: InanoSQLQuery, fnString: string, row: any, prev: any) => InanoSQLFunctionResult;
/**
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
export declare const cast: (type: string, val: any, allowUknownTypes?: boolean | undefined, nSQL?: InanoSQLInstance | undefined) => any;
export declare const rad2deg: (rad: number) => number;
export declare const deg2rad: (deg: number) => number;
/**
 * "As the crow flies" or Haversine formula, used to calculate the distance between two points on a sphere.
 *
 * The unit used for the radius will determine the unit of the answer.  If the radius is in km, distance provided will be in km.
 *
 * The radius is in km by default.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @param {number} radius
 * @returns {number}
 */
export declare const crowDistance: (lat1: number, lon1: number, lat2: number, lon2: number, radius?: number) => number;
export declare const levenshtein: (word1: string, word2: string) => number;
export declare const resolvePath: (pathQuery: string) => string[];
export declare const getFnValue: (row: any, valueOrPath: string) => any;
/**
 * Recursively freeze a javascript object to prevent it from being modified.
 *
 * @param {*} obj
 * @returns
 */
export declare const deepFreeze: (obj: any) => any;
export declare const deepSet: (pathQuery: string | string[], object: any, value: any) => any;
/**
 * Take an object and a string describing a path like "value.length" or "val[length]" and safely get that value in the object.
 *
 * objQuery("hello", {hello: 2}) => 2
 * objQuery("hello.length", {hello: [0]}) => 1
 * objQuery("hello[0]", {hello: ["there"]}) => "there"
 * objQuery("hello[0].length", {hello: ["there"]}) => 5
 * objQuery("hello.color.length", {"hello.color": "blue"}) => 4
 *
 * @param {string} pathQuery
 * @param {*} object
 * @param {boolean} [ignoreFirstPath]
 * @returns {*}
 */
export declare const deepGet: (pathQuery: string | string[], object: any) => any;
export declare const maybeAssign: (obj: any) => any;
export declare const setFast: (...args: any[]) => void;
