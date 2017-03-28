import { NanoSQLInstance, _assign, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs, DBFunction } from "./index";
import { _NanoSQLDB, _str } from "./db-index";
import { IHistoryPoint, _NanoSQL_Storage } from "./db-storage";

/**
 * Min/Max function for database
 *
 * @internal
 * @param {number} type
 * @param {DBRow} row
 * @param {string[]} args
 * @param {number[]} ptr
 * @param {*} prev
 * @returns
 */
const minMax = (type: number, row: DBRow, args: string[], ptr: number[], prev: any) => {
    const key = args[0];
    if (ptr[0] === 0) prev[key] = type === -1 ? Number.MAX_VALUE : Number.MIN_VALUE;
    let nextRow = {};
    if (type === -1 ? parseFloat(row[key]) < parseFloat(prev[key]) : parseFloat(row[key]) > parseFloat(prev[key])) {
        nextRow = row;
    } else {
        nextRow = prev;
    }
    if (ptr[0] === ptr[1]) { // last row
        let r = _assign(nextRow);
        r[type === -1 ? "MIN" : "MAX"] = nextRow[key];
        return r;
    } else {
        return nextRow;
    }
};

/**
 * @internal
 */
export let _functions: {
    [key: string]: DBFunction
} = {
    SUM: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: number) => {
            if (ptr[0] === 0) prev = 0;
            prev += parseInt(row[args[0]]);
            if (ptr[0] === ptr[1]) {
                let r = _assign(row);
                r.SUM = prev;
                return r;
            } else {
                return prev;
            }
        }
    },
    MIN: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: any) => {
            return minMax(-1, row, args, ptr, prev);
        }
    },
    MAX: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: any) => {
            return minMax(1, row, args, ptr, prev);
        }
    },
    AVG: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: number) => {
            if (ptr[0] === 0) prev = 0;
            prev += parseInt(row[args[0]]);
            if (ptr[0] === ptr[1]) {
                let r = _assign(row);
                r.AVG = (prev / (ptr[1] + 1)) || prev;
                return r;
            } else {
                return prev;
            }
        }
    },
    COUNT: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: number) => {
            if (ptr[0] === 0) prev = 0;

            if (args[0] === "*") {
                prev++;
            } else {
                prev += row[args[0]] ? 1 : 0;
            }

            if (ptr[0] === ptr[1]) {
                let r = _assign(row);
                r.COUNT = prev;
                return r;
            } else {
                return prev;
            }
        }
    }
};

/**
 * Query module called for each database execution to get the desired result on the data.
 *
 * @internal
 * @class _NanoSQLQuery
 */
// tslint:disable-next-line
export class _NanoSQLQuery {

    /**
     * The current action being called by the query. Select, Upsert, etc.
     *
     * @internal
     * @type {(QueryLine|undefined)}
     * @memberOf _NanoSQLQuery
     */
    private _act: QueryLine|undefined;

    /**
     * Query modifiers like where, orderby, etc.
     *
     * @internal
     * @type {Array<QueryLine>}
     * @memberOf _NanoSQLQuery
     */
    private _mod: Array<QueryLine>;

    /**
     * A hash of the current query arguments.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLQuery
     */
    private _queryHash: number;

    /**
     * A reference to the parent immutable storage object.
     *
     * @internal
     * @type {_NanoSQLDB}
     * @memberOf _NanoSQLQuery
     */
    private _db: _NanoSQLDB;

    /**
     * Holds a pointer to the joined table for join queries
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLQuery
     */
    private _joinTable: number;

    /**
     * Selected table.
     *
     * @private
     * @type {number}
     * @memberOf _NanoSQLQuery
     */
    private _tableID: number;

    constructor(database: _NanoSQLDB) {
        this._db = database;
    }

    /**
     * Setup the query then call the execution command.
     *
     * @internal
     * @param {DBExec} query
     * @returns {Promise<any>}
     *
     * @memberOf _NanoSQLQuery
     */
    public _doQuery(query: DBExec): void {
        let t = this;

        t._tableID = NanoSQLInstance._hash(query.table);
        t._mod = [];
        t._act = undefined;

        let simpleQuery: QueryLine[] = [];

        query.query.forEach((q) => {
            if (["upsert", "select", "delete", "drop"].indexOf(q.type) >= 0) {
                t._act = q; // Query Action
                if (q.type === "select") t._queryHash = NanoSQLInstance._hash(JSON.stringify(query.query));
            } else if (["show tables", "describe"].indexOf(q.type) >= 0) {
                simpleQuery.push(q);
            } else {
                t._mod.push(q); // Query Modifiers
            }
        });

        if (simpleQuery.length) {
            switch (simpleQuery[0].type) {
                case "show tables":
                    query.onSuccess([{tables: Object.keys(t._db._store._tables).map((ta) => t._db._store._tables[ta]._name)}], "info", []);
                break;
                case "describe":
                    let getTable;
                    let tableName = t._tableID;
                    let rows = {};
                    Object.keys(t._db._store._tables).forEach((ta) => {
                        if (parseInt(ta) === t._tableID) {
                            getTable = _assign(t._db._store._models[ta]);
                            tableName = t._db._store._tables[ta]._name;
                        }
                    });

                    rows[tableName] = getTable;
                    query.onSuccess([rows], "info", []);
                break;
            }
        } else {
            t._execQuery((result: Array<Object>, changeType: string, affectedRows: DBRow[]) => {
                query.onSuccess(result, changeType, affectedRows);
            });
        }
    }

    /**
     * Get a query modifier (where/orderby/etc...)
     *
     * @internal
     * @param {string} name
     * @returns {(QueryLine|undefined)}
     *
     * @memberOf _NanoSQLQuery
     */
    private _getMod(name: string): QueryLine|undefined {
        return this._mod.filter((v) => v.type === name).pop();
    };


    /**
     * Starting query method, sets up initial environment for the query and sets it off.
     *
     * @internal
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     * @returns {void}
     *
     * @memberOf _NanoSQLQuery
     */
    private _execQuery(callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void): void {
        const t = this;
        if (!t._act) return;

        const doQuery = (rows: DBRow[]) => {
            if (!t._act) return;
            switch (t._act.type) {
                case "upsert":
                    t._upsert(rows, callBack);
                break;
                case "select":
                    t._select(rows, callBack);
                break;
                case "drop":
                case "delete":
                    t._remove(rows, callBack);
                break;
            }
        };

        const tableData = t._db._store._tables[t._tableID];

        if (!t._getMod("join") && t._act.type !== "drop") {
            if (t._getMod("where")) {
                const whereArgs = (t._getMod("where") as QueryLine).args;

                // Primary key optimization, if we're grabbing a value by it's pk we can skip the full table read
                whereArgs[1] = whereArgs[1].trim();
                if (typeof whereArgs[0] === "string" && whereArgs[0].trim() === tableData._pk && ["=", "IN"].indexOf(whereArgs[1]) !== -1) {
                    // Goes straight to the right row
                    let rowPks: any[] = [];
                    if (whereArgs[1] === "=") {
                        rowPks.push(whereArgs[2]);
                    } else {
                        rowPks = whereArgs[2];
                    }
                    let i = 0;
                    let rows: any[] = [];
                    const getRow = () => {
                        if (i < rowPks.length) {
                            t._db._store._read(tableData._name, rowPks[i], (result) => {
                                rows = rows.concat(result);
                                i++;
                                getRow();
                            });
                        } else {
                            doQuery(rows);
                        }
                    };
                    getRow();
                } else {
                    // Full table scan
                    t._db._store._read(tableData._name, (row) => {
                        return row && t._where(row, (t._getMod("where") as QueryLine).args);
                    }, (rows) => {
                        doQuery(rows);
                    });
                }
            } else {
                if (t._act.type !== "upsert") {
                    t._db._store._read(tableData._name, "all", (rows) => {
                        doQuery(rows);
                    });
                } else {
                    doQuery([]);
                }
            }
        } else {
            doQuery([]);
        }

    }

    /**
     * Updates a given row with a specific value, also updates the history for that row as needed.
     *
     * @internal
     * @param {string} rowPK
     *
     * @memberOf _NanoSQLQuery
     */
    private _updateRow(rowPK: string, callBack: Function): void {

        const t = this;
        const tableName = t._db._store._tables[t._tableID]._name;

        t._db._store._read(tableName, rowPK, (rows) => {
            let newRow = {};
            const oldRow = rows[0] || {};

            const qArgs = (t._act as QueryLine).args;
            const updateType = ((): string => {
                if (t._act) {
                    if (t._act.type === "delete" && !qArgs.length) {
                        return "drop";
                    }
                }
                return t._act ? t._act.type : "";
            })();

            let doRemove = false;

            switch (updateType) {
                case "upsert":
                    newRow = oldRow ? _assign(oldRow) : {};
                    /*if(!t._db._doingTransaction) {
                        newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                    } else {
                        newRow = oldRow || {};
                    }*/

                    Object.keys(qArgs).forEach((k) => {
                        newRow[k] = qArgs[k];
                    });

                    // Add default values
                    let table = t._db._store._tables[t._tableID];
                    table._keys.forEach((k, i) => {
                        let def = table._defaults[i];
                        if (!newRow[k] && def) newRow[k] = def;
                    });
                break;
                case "delete":
                    newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                    if (qArgs && qArgs.length) {
                        qArgs.forEach((column) => {
                            newRow[column] = null;
                        });
                    } else {
                        doRemove = true;
                        newRow = {};
                    }
                break;
            }

            const finishUpdate = () => {
                if (tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                    t._db._store._read("_" + tableName + "_hist__meta", parseInt(rowPK), (rows) => {
                        rows[0][_str(3)].unshift(len);
                        t._db._store._upsert("_" + tableName + "_hist__meta", parseInt(rowPK), rows[0]);
                    });
                }

                // 3. Move new row data into place on the active table
                // Apply changes to the store
                if (updateType === "upsert") {
                    t._db._store._upsert(tableName, rowPK, newRow, () => {
                        callBack();
                    });
                } else {
                    t._db._store._delete(tableName, rowPK, () => {
                        callBack();
                    });
                }
            };

            // Add to history
            let len = 0; // 0 index contains a null reference used by all rows;
            if (!doRemove && tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                // 1. copy new row data into histoy data table
                t._db._store._upsert("_" + tableName + "_hist__data", null, newRow, (rowID) => {
                    len = parseInt(rowID as string);
                    finishUpdate();
                });
            } else {
                finishUpdate();
            }

        });
    }

    /**
     * Called to finish drop/delete/upsert queries to affect the history and memoization as needed.
     *
     * @internal
     * @param {string[]} updatedRowPKs
     * @param {string} describe
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    private _tableChanged(updatedRowPKs: string[], describe: string, callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void): void {
        let t = this, k = 0, j = 0;

        if (updatedRowPKs.length > 0) {

            const completeChange = () => {

                if (t._db._store._doHistory) {
                    if (!t._db._store._doingTransaction && t._db._store._historyPoint === 0) {
                        t._db._store._historyLength++;
                    }

                    t._db._store._utility("w", "historyLength", t._db._store._historyLength);
                    t._db._store._utility("w", "historyPoint", t._db._store._historyPoint);

                    // Add history records
                    t._db._store._upsert("_historyPoints", null, {
                        historyPoint: t._db._store._historyLength - t._db._store._historyPoint,
                        tableID: t._tableID,
                        rowKeys: updatedRowPKs.map(r => parseInt(r)),
                        type: describe
                    }, (rowID) => {
                        let table = t._db._store._tables[this._tableID];
                        t._db._invalidateCache(t._tableID, [], "");
                        t._db._store._read(table._name, (row) => {
                            return row && updatedRowPKs.indexOf(row[table._pk]) !== -1;
                        }, (rows) => {
                            callBack([{msg: updatedRowPKs.length + " row(s) " + describe}], describe, rows);
                        });

                    });
                } else {
                    let table = t._db._store._tables[t._tableID];
                    t._db._invalidateCache(t._tableID, [], "");
                    t._db._store._read(table._name, (row) => {
                        return row && updatedRowPKs.indexOf(row[table._pk]) !== -1;
                    }, (rows) => {
                        callBack([{msg: updatedRowPKs.length + " row(s) " + describe}], describe, rows);
                    });
                }
            };

            if (t._db._store._doHistory) {
                // Remove history points ahead of the current one if the database has changed
                if (t._db._store._historyPoint > 0 && t._db._store._doingTransaction !== true) {

                    t._db._store._read("_historyPoints", (hp: IHistoryPoint) => {
                        if (hp.historyPoint > t._db._store._historyLength - t._db._store._historyPoint) return true;
                        return false;
                    }, (historyPoints: IHistoryPoint[]) => {

                        j = 0;
                        const nextPoint = () => {

                            if (j < historyPoints.length) {
                                let tableName = t._db._store._tables[historyPoints[j].tableID]._name;
                                k = 0;
                                const nextRow = () => {
                                    if (k < historyPoints[j].rowKeys.length) {
                                        // Set this row history pointer to 0;
                                        t._db._store._read("_" + tableName + "_hist__meta", historyPoints[j].rowKeys[k], (rows) => {
                                            rows[0] = _assign(rows[0]);
                                            rows[0][_str(2)] = 0;
                                            let del = rows[0][_str(3)].shift(); // Shift off the most recent update
                                            t._db._store._upsert("_" + tableName + "_hist__meta", historyPoints[j].rowKeys[k], rows[0], () => {
                                                if (del) {
                                                    t._db._store._delete("_" + tableName + "_hist__data", del, () => {
                                                        k++;
                                                        nextRow();
                                                    });
                                                } else {
                                                    k++;
                                                    nextRow();
                                                }
                                            });
                                        });
                                    } else {
                                        j++;
                                        nextPoint();
                                    }
                                };
                                t._db._store._delete("_historyPoints", historyPoints[j].id, () => { // remove this point from history
                                    nextRow();
                                });
                            } else {
                                t._db._store._historyLength -= t._db._store._historyPoint;
                                t._db._store._historyPoint = 0;
                                completeChange();
                                return;
                            }
                        };
                        nextPoint();
                    });

                } else {
                    completeChange();
                }
            } else {
                completeChange();
            }

        } else {
            callBack([{msg: "0 rows " + describe}], describe, []);
        }
    };

    /**
     * Add/modify records to a specific table based on query parameters.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    private _upsert(queryRows: DBRow[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {
        let t = this;
        let scribe = "", i, changedPKs: string[] = [];

        const qArgs = (t._act as QueryLine).args  || {},
        table = t._db._store._tables[t._tableID],
        pk = table._pk,
        whereMod = t._getMod("where");

        if (whereMod) { // Where statement exists or there's no PK, we're inserting data into existing rows
            scribe = "modified";
            changedPKs = queryRows.map((r) => r[table._pk]);
            i = 0;
            const update = () => {
                if (i < queryRows.length) {
                    t._updateRow(queryRows[i][pk], () => {
                        i++;
                        update();
                    });
                } else {
                    t._tableChanged(changedPKs, scribe, callBack);
                }
            };
            update();
        } else { // No where statment, perform upsert
            scribe = "inserted";

            if (!qArgs[pk]) {
                if (table._pkType === "int") {
                    qArgs[pk] = table._incriment++;
                } else if (table._pkType === "uuid") {
                    qArgs[pk] = NanoSQLInstance.uuid();
                }
            } else {
                if (table._pkType === "int") {
                    table._incriment = Math.max(qArgs[pk] + 1, table._incriment);
                }
            }

            const objPK = qArgs[pk] ? String(qArgs[pk]) : String(table._index.length);
            changedPKs = [objPK];

            // Entirely new row, setup all the needed stuff for it.
            if (table._index.indexOf(objPK) === -1) {
                // History
                let tableName = t._db._store._tables[t._tableID]._name;
                if (tableName.indexOf("_") !== 0) {
                    let histTable = "_" + tableName + "_hist__meta";
                    let histRow = {};
                    histRow[_str(2)] = 0;
                    histRow[_str(3)] = [0];
                    t._db._store._upsert(histTable, objPK, histRow);
                }

                // Index
                table._index.push(objPK);
            }

            t._updateRow(objPK, () => {
                t._tableChanged(changedPKs, scribe, callBack);
            });
        }
    }

    /**
     * Get the table ID for query commands, used to intelligently switch between joined tables and the regular ones.
     *
     * @internal
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    private _getTableID() {
        return this._joinTable ? this._joinTable : this._tableID;
    }

    /**
     * Selects rows from a given table using the query parameters.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    private _select(queryRows: DBRow[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {

        let t = this;
        // Memoization
        if (t._db._queryCache[t._tableID][t._queryHash]) {
            callBack(t._db._queryCache[t._tableID][t._queryHash], "none", []);
            return;
        }

        const mods = ["join", "groupby", "having", "orderby", "offset", "limit"];
        let curMod, column, i, k, rows, obj, rowData, groups = {};
        const sortObj = (objA: DBRow, objB: DBRow, columns: {[key: string]: string}) => {
            return Object.keys(columns).reduce((prev, cur) => {
                if (!prev) {
                    if (objA[cur] === objB[cur]) return 0;
                    return (objA[cur] > objB[cur] ? 1 : -1) * (columns[cur] === "desc" ? -1 : 1);
                } else {
                    return prev;
                }
            }, 0);
        };

        const modifyQuery = (tableIndex: any[], modIndex: number, next: (tableIndex: any[]) => void): void => {

            curMod = t._getMod(mods[modIndex]);

            // After GROUP BY command apply functions and AS statements
            if (modIndex === 2) {
                let functions: {name: string, args: string[], as: string, type: string}[] = [];
                if (qArgs.length) { // Select statement arguments
                    let funcs = Object.keys(_functions).map((f) => f + "(");
                    let keepColumns: any[] = [];
                    functions = qArgs.filter((q) => {
                        let hasFunc = funcs.reduce((prev, cur) => {
                            return (q.indexOf(cur) < 0 ? 0 : 1) + prev;
                        }, 0) || 0;
                        if (hasFunc > 0) {
                            return true;
                        } else {
                            keepColumns.push(q);
                            return false;
                        }
                    }).map((selectString) => {
                        let regex = selectString.match(/(.*)\((.*)\)/);
                        let funcName = regex[1].trim();
                        let columnName = (selectString.match(/\sAS\s(.*)/) || []).pop() || funcName;
                        let args = regex[2].split(",").map(s => s.trim());

                        if (_functions[funcName].type === "simple" && columnName === funcName) {
                            columnName = args[0];
                        }

                        keepColumns.push(columnName);
                        return {
                            name: funcName,
                            args: args,
                            as: columnName.trim(),
                            type: _functions[funcName].type
                        };
                    });

                    let rows: DBRow[] = [];

                    if (functions.length) {

                        let prevFunc;
                        const doFunctions = (rows: DBRow[]): DBRow[] => {
                            return functions.sort((a, b) => {
                                return a.type > b.type ? 1 : -1;
                            }).reduce((prev, curr) => {
                                let len = prev.length - 1;

                                if (curr.type === "aggregate") {
                                    let newRows = rows.slice();
                                    len = newRows.length - 1;
                                    newRows = [newRows.reduce((p, v, i) => {
                                        return _functions[curr.name].call(v, curr.args, [i, len], p);
                                    }, {})];

                                    if (prevFunc) {
                                        newRows[0][prevFunc] = prev[0][prevFunc];
                                    }
                                    prev = newRows;
                                    prevFunc = curr.name;
                                } else {
                                    prev = prev.map((v, i) => {
                                        return _functions[curr.name].call(v, curr.args, [i, len]);
                                    });
                                }

                                if (curr.name !== curr.as) {
                                    keepColumns.push(curr.name + " AS " + curr.as);
                                } else {
                                    keepColumns.push(curr.name);
                                }

                                return prev;
                            }, rows.slice());
                        };

                        let groupKeys: any = Object.keys(groups);
                        if (groupKeys.length) { // Groups Exist
                            rows = groupKeys
                            .map((k) => doFunctions(groups[k])) // Apply each function to each group (N^2)
                            .reduce((prev, curr) => { // Combine the results into a single array
                                return prev = prev.concat(curr), prev;
                            }, []);
                        } else { // No Groups, apply all functions to the rows
                            rows = doFunctions(tableIndex);
                        }
                    } else {
                        rows = tableIndex;
                    }

                    let convertKeys = keepColumns.map((n) => {
                        return n.match(/(.*)\sAS\s(.*)/) || n;
                    }).filter(n => n) || [];

                    if (convertKeys.length) {
                        rows = rows.map((r) => {
                            r = _assign(r);
                            let newRow = {};
                            convertKeys.forEach((key) => {
                                if (typeof key === "string") {
                                    newRow[key] = r[key];
                                } else {
                                    newRow[key[2]] = r[key[1]];
                                }
                            });
                            return newRow;
                        });
                    }

                    tableIndex = rows;
                }
            }

            if (!curMod) return next(tableIndex);

            switch (modIndex) {
                case 0: // Join
                    let joinConditions;
                    if (curMod.args.type !== "cross") {
                        joinConditions = {
                            _left: curMod.args.where[0].split(".").pop(),
                            _check: curMod.args.where[1],
                            _right: curMod.args.where[2].split(".").pop()
                        };
                    }

                    let leftTableID = t._tableID;

                    let rightTableID = NanoSQLInstance._hash(curMod.args.table);

                    let where = t._getMod("where") as QueryLine;

                    t._join(curMod.args.type, leftTableID, rightTableID, joinConditions, (joinedRows) => {
                        if (where) {
                            next(joinedRows.filter((row: DBRow) => {
                                return t._where(row, where.args);
                            }));
                        } else {
                            next(joinedRows);
                        }
                    });

                    break;
                case 1: // Group By
                    let columns = curMod.args as {[key: string]: "asc"|"desc"};
                    let sortGroups = {};
                    if (columns) {
                        groups = tableIndex.reduce((prev, curr: DBRow) => {
                            let key = Object.keys(columns).reduce((p, c) => p + "." + String(curr[c]), "").slice(1);
                            (prev[key] = prev[key] || []).push(curr);
                            sortGroups[key] = Object.keys(columns).reduce((pr, cu) => {
                                pr[cu] = curr[cu];
                                return pr;
                            }, {});
                            return prev;
                        }, {});

                        next(Object.keys(groups).sort((a, b) => {
                            return sortObj(sortGroups[a], sortGroups[b], columns);
                        }).reduce((prev, curr) => {
                            return prev.concat(groups[curr]);
                        }, []));
                    } else {
                        next(tableIndex);
                    }
                    break;
                case 2: // Having
                    next(tableIndex.filter((row: DBRow) => {
                        return t._where(row, (t._getMod("having") as QueryLine).args);
                    }));
                    break;
                case 3: // Order By
                    next(tableIndex.sort((a: DBRow, b: DBRow) => {
                        return sortObj(a, b, curMod.args);
                    }));
                    break;
                case 4: // Offset
                    next(tableIndex.filter((row: DBRow, index: number) => {
                        return curMod ? index >= curMod.args : true;
                    }));
                    break;
                case 5: // Limit
                    next(tableIndex.filter((row: DBRow, index: number) => {
                        return curMod ?  index < curMod.args : true;
                    }));
                    break;
            }
        };

        i = -1;

        const qArgs = (t._act as QueryLine).args  || [];
        const stepQuery = (rowPKs: any[]) => {
            if (i < mods.length) {
                i++;
                modifyQuery(rowPKs, i, (resultRows: any[]) => {
                    stepQuery(resultRows);
                });
            } else {
                rowPKs = rowPKs.filter(r => r);
                if (!t._getMod("join")) { // Join commands are not memoized.
                    t._db._queryCache[t._tableID][t._queryHash] = rowPKs;
                }
                callBack(rowPKs, "none", []);
            }
        };

        stepQuery(queryRows);

    }

    /**
     * Removes elements from the currently selected table based on query conditions.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    private _remove(queryRows: DBRow[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {
        let scribe = "deleted", i;
        let t = this;
        const qArgs = (t._act as QueryLine).args  || [];
        let pk = t._db._store._tables[t._tableID]._pk;
        i = 0;

        const remove = () => {
            if (i < queryRows.length) {
                t._updateRow(queryRows[i][pk], () => {
                    i++;
                    remove();
                });
            } else {
                if (qArgs.length) scribe = "modified";
                t._tableChanged(queryRows.map(r => r[pk]), scribe, callBack);
            }
        };
        remove();
    }

    /**
     * Performs "where" filtering on a given table provided where conditions.
     *
     * @internal
     * @param {number} tableID
     * @param {string[]} searchIndex
     * @param {any[]} conditions
     * @returns {string[]}
     *
     * @memberOf _NanoSQLQuery
     */
    private _where(row: DBRow, conditions: any[]): boolean {
        let t = this;
        const commands = ["AND", "OR"];
        if (typeof conditions[0] !== "string") {
            let prevCmd: string;
            return conditions.reduce((prev, cur, i) => {
                if (commands.indexOf(cur) !== -1) {
                    prevCmd = cur;
                    return prev;
                } else {
                    let compare = t._compare(cur[2], cur[1], row[cur[0]]) === 0 ? true : false;
                    if (i === 0) return compare;
                    if (prevCmd === "AND") {
                        return prev && compare;
                    } else { // OR
                        return prev || compare;
                    }
                }
            }, true);
        } else {
            return t._compare(conditions[2], conditions[1], row[conditions[0]]) === 0 ? true : false;
        }
    }

    /**
     * Perform a join between two tables.  Generates a new table with the joined records.
     *
     * Joined tables are not memoized or cached in any way, they are generated from scrach on every query.
     *
     * @private
     * @param {("left"|"inner"|"right"|"cross"|"outer")} type
     * @param {any[]} whereArgs
     * @param {number} leftTableID
     * @param {number} rightTableID
     * @param {(null|{_left: string, _check: string, _right: string})} joinConditions
     * @param {(rows:DBRow[]) => void} complete
     * @returns {void}
     *
     * @memberOf _NanoSQLQuery
     */
    private _join(type: "left"|"inner"|"right"|"cross"|"outer", leftTableID: number, rightTableID: number, joinConditions: null|{_left: string, _check: string, _right: string}, complete: (rows: DBRow[]) => void): void {
        const L = "left";
        const R = "right";
        const O = "outer";
        let joinHelper: {[tableID: number]: {_keys: string[], _name: string}} = {};
        let t = this;

        let leftTableData = t._db._store._tables[leftTableID];
        let rightTableData = t._db._store._tables[rightTableID];

        const doJoinRows = (leftRow: DBRow|null, rightRow: DBRow|null) => {
            return [leftTableData, rightTableData].reduce((prev, cur, i) => {
                cur._keys.forEach((k) => {
                    prev[cur._name + "." + k] = ((i === 0 ? leftRow : rightRow) || {})[k];
                });
                return prev;
            }, {});
        };

        let joinTable: DBRow[] = [];
        let rightUsedPKs: string[] = [];

        t._db._store._read(leftTableData._name, "all", (leftRows: DBRow[]) => {
            t._db._store._read(rightTableData._name, "all", (rightRows: DBRow[]) => {

                leftRows.forEach((leftRow) => {
                    let joinRows = rightRows.filter((rightRow) => {
                        if (!joinConditions) return true;
                        let joinedRow = doJoinRows(leftRow, rightRow);
                        let keep = t._where(joinedRow, [joinConditions._left, joinConditions._check, joinConditions._right]);
                        if (keep) rightUsedPKs.push(rightRow[rightTableData._pk]);
                        return keep;
                    });

                    if (joinRows.length) { // All joins bring together rows that succesfully compare.
                        joinTable = joinTable.concat(joinRows);
                    } else if ([L, O].indexOf(type) >= 0) { // If no comparison, left and outer joins should add an entry with a null right side.
                        joinTable.push(doJoinRows(leftRow, null));
                    }
                });

                rightUsedPKs = rightUsedPKs.sort().filter((item, pos, ary) => {  // Remove duplicates
                    return !pos || item !== ary[pos - 1];
                });

                // If this is a RIGHT or OUTER join we're going to add the right side rows that haven't been used.
                if ([R, O].indexOf(type) >= 0) {
                    rightRows.filter((r) => { // Only include rows not added already
                        return rightUsedPKs.indexOf(r[rightTableData._pk]) === -1;
                    }).forEach((rightRow) => {
                        joinTable.push(doJoinRows(null, rightRow));
                    });
                }

                complete(joinTable);
            });
        });
    }

    /**
     * Compare two values together given a comparison value
     *
     * @internal
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {number}
     *
     * @memberOf _NanoSQLQuery
     */
    private _compare(val1: any, compare: string, val2: any): number {
        switch (compare) {
            case "=": return val2 === val1 ? 0 : 1;
            case ">": return val2 > val1 ? 0 : 1;
            case "<": return val2 < val1 ? 0 : 1;
            case "<=": return val2 <= val1 ? 0 : 1;
            case ">=": return val2 >= val1 ? 0 : 1;
            case "IN": return val1.indexOf(val2) < 0 ? 1 : 0;
            case "NOT IN": return val1.indexOf(val2) < 0 ? 0 : 1;
            case "REGEX":
            case "LIKE": return val2.search(val1) < 0 ? 1 : 0;
            case "BETWEEN": return val1[0] < val2 && val1[1] > val2 ? 0 : 1;
            default: return 0;
        }
    }
}