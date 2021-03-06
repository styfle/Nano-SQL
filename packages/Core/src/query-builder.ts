import { InanoSQLQueryBuilder, InanoSQLInstance, InanoSQLQuery, InanoSQLJoinArgs, InanoSQLGraphArgs, TableQueryResult } from "./interfaces";
import { buildQuery, uuid, noop } from "./utilities";

// tslint:disable-next-line
export class _nanoSQLQueryBuilder implements InanoSQLQueryBuilder {

    public _db: InanoSQLInstance;

    public _error: string;

    public _AV: string;

    public _query: InanoSQLQuery;

    public static execMap: any;

    constructor(db: InanoSQLInstance, table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>), queryAction: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), queryArgs?: any, actionOrView?: string) {
        this._db = db;

        this._AV = actionOrView || "";

        if (typeof queryAction === "string") {
            this._query = {
                ...buildQuery(db, table, queryAction),
                comments: [],
                state: "pending",
                action: queryAction,
                actionArgs: queryArgs,
                result: []
            };
        } else {
            this._query = {
                ...queryAction(db),
                state: "pending",
                result: []
            };
        }
    }

    public where(args: any[] | ((row: { [key: string]: any }, i?: number) => boolean)): _nanoSQLQueryBuilder {
        this._query.where = args;
        return this;
    }


    public orderBy(columns: string[] | {[col: string]: string}): _nanoSQLQueryBuilder {
        if (Array.isArray(columns)) {
            this._query.orderBy = columns;
        } else {
            this._query.orderBy = Object.keys(columns).map((col) => `${col} ${String(columns[col]).toUpperCase()}`);
        }
        return this;
    }

    public groupBy(columns: string[] | {[col: string]: string}): _nanoSQLQueryBuilder {
        if (Array.isArray(columns)) {
            this._query.groupBy = columns;
        } else {
            this._query.groupBy = Object.keys(columns).map((col) => `${col} ${String(columns[col]).toUpperCase()}`);
        }
        return this;
    }

    public having(args: any[] | ((row: { [key: string]: any }, i?: number) => boolean)): _nanoSQLQueryBuilder {
        this._query.having = args;
        return this;
    }


    public join(args: InanoSQLJoinArgs | InanoSQLJoinArgs[]): _nanoSQLQueryBuilder {
        const err = "Join commands requires table and type arguments!";
        if (Array.isArray(args)) {
            args.forEach((arg) => {
                if (!arg.with.table || !arg.type) {
                    this._error = err;
                }
            });
        } else {
            if (!args.with.table || !args.type) {
                this._error = err;
            }
        }

        this._query.join = args;
        return this;
    }


    public limit(args: number): _nanoSQLQueryBuilder {
        this._query.limit = args;
        return this;
    }

    public comment(comment: string): _nanoSQLQueryBuilder {
        this._query.comments.push(comment);
        return this;
    }

    public tag(tag: string): _nanoSQLQueryBuilder {
        this._query.tags.push(tag);
        return this;
    }

    public extend(scope: string, ...args: any[]): _nanoSQLQueryBuilder {
        this._query.extend.push({ scope: scope, args: args });
        return this;
    }

    public union(queries: (() => Promise<any[]>)[], unionAll?: boolean): _nanoSQLQueryBuilder {
        this._query.union = {
            queries: queries,
            type: unionAll ? "all" : "distinct"
        };
        return this;
    }

    public offset(args: number): _nanoSQLQueryBuilder {
        this._query.offset = args;
        return this;
    }

    public emit(): InanoSQLQuery {
        return this._query;
    }

    public ttl(seconds: number = 60, cols?: string[]): _nanoSQLQueryBuilder {
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    }

    public graph(ormArgs: InanoSQLGraphArgs[]): _nanoSQLQueryBuilder {
        this._query.graph = ormArgs;
        return this;
    }

    public from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string
    } | string): _nanoSQLQueryBuilder {
        if (typeof tableObj === "string") {
            this._query.table = tableObj;
        } else {
            this._query.table = tableObj.table;
            this._query.tableAS = tableObj.as;
        }
        return this;
    }

    public into(table: string): _nanoSQLQueryBuilder {
        this._query.table = table;
        return this;
    }

    public on(table: string): _nanoSQLQueryBuilder {
        this._query.table = table;
        return this;
    }

    public toCSV(headers?: boolean): any {
        let t = this;
        return t.exec().then((json: any[]) => Promise.resolve(t._db.JSONtoCSV(json, headers)));
    }

    public exec(returnEvents?: boolean): Promise<any[]> {

        return new Promise((res, rej) => {
            let buffer: any[] = [];
            this._query.returnEvent = returnEvents;
            this.stream((row) => {
                if (row) {
                    buffer.push(row);
                }
            }, () => {
                res(buffer);
            }, rej);
        });
    }

    public streamEvent(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void {
        this._query.returnEvent = true;
        this._db.triggerQuery(this._query, onRow, complete, err);
    }

    public stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void {
        this._db.triggerQuery(this._query, onRow, complete, err);
    }

    public cache(cacheReady: (cacheId: string, recordCount: number) => void, error: (error: any) => void, streamPages?: {pageSize: number, onPage: (page: number, rows: any[]) => void, doNotCache?: boolean}): void {
        const id = uuid();
        let buffer: any[] = [];
        let didPage: boolean = false;
        let pageNum = 0;
        const streamObj = streamPages || {pageSize: 0, onPage: noop};
        this.stream((row) => {
            buffer.push(row);
            if (streamObj.pageSize && streamObj.onPage && buffer.length % streamObj.pageSize === 0) {
                didPage = true;
                streamObj.onPage(pageNum, buffer.slice(buffer.length - streamObj.pageSize));
                pageNum++;
                if (streamObj.doNotCache) {
                    buffer = [];
                }
            }
        }, () => {
            if (streamObj.pageSize && streamObj.onPage) {
                if (!didPage || streamObj.doNotCache) { // didn't make it to the page size in total records
                    streamObj.onPage(0, buffer.slice());
                } else { // grab the remaining records
                    streamObj.onPage(pageNum, buffer.slice(pageNum * streamObj.pageSize));
                }
            }
            if (!streamObj.doNotCache) {
                this._db._queryCache[id] = buffer;
                cacheReady(id, buffer.length);
            } else {
                buffer = [];
                cacheReady("", 0);
            }
        }, error)
    }
}