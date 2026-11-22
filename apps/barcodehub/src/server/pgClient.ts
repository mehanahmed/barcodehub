import { query } from './postgres';

export type FilterValue =
  | any
  | { contains?: string }
  | { not?: any }
  | { in?: any[] }
  | { notIn?: any[] }
  | { lt?: any }
  | { lte?: any }
  | { gt?: any }
  | { gte?: any };

export type RecordFilters = Record<string, FilterValue>;

export interface FindAllParams {
  filters?: RecordFilters;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  offset?: number;
  limit?: number;
  fields?: string[];
}

export interface FindOneParams {
  id?: string;
  filters?: RecordFilters;
  fields?: string[];
}

const SORTABLE_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
  Packages: new Set(['id', 'name', 'monthlyPrice', 'yearlyPrice', 'productLimit', 'features', 'analyticsEnabled', 'isActive', 'sortOrder', 'created_at', 'updated_at']),
  Tenants: new Set(['id', 'companyName', 'slug', 'status', 'package', 'subscriptionEnds', 'created_at', 'updated_at']),
  Products: new Set(['id', 'tenant', 'title', 'barcodeNumber', 'barcodeType', 'brand', 'manufacturer', 'category', 'netWeight', 'countryOfOrigin', 'mrp', 'status', 'created_at', 'updated_at']),
  Payments: new Set(['id', 'tenant', 'package', 'transactionId', 'method', 'billingPeriod', 'amount', 'senderNumber', 'status', 'adminNote', 'reviewedAt', 'submittedAt', 'created_at', 'updated_at']),
  ProductViews: new Set(['id', 'viewNumber', 'product', 'tenant', 'source', 'created_at']),
  Admins: new Set(['id', 'email', 'name', 'userId', 'created_at', 'updated_at']),
  ziteUsers: new Set(['id', 'email', 'name', 'firstName', 'lastName', 'image', 'created_at', 'updated_at']),
};

export function createPgTableClient<T extends Record<string, any>, TInput = Partial<T>>(tableName: string) {
  const table = `"${tableName}"`;
  const jsonCols = new Set(['owner', 'logo', 'images']);

  function sanitizeColValue(k: string, v: any): any {
    if (v === null || v === undefined) {
      return null;
    }
    if (jsonCols.has(k)) {
      if (typeof v === 'object' && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            JSON.parse(trimmed);
            return trimmed;
          } catch {
            // Not valid JSON, wrap in array
          }
        }
        return JSON.stringify([v]);
      }
    }
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      return JSON.stringify(v);
    }
    return v;
  }

  function buildWhere(filters?: RecordFilters, startIdx = 1): { where: string; params: any[]; nextIdx: number } {
    if (!filters || Object.keys(filters).length === 0) {
      return { where: '', params: [], nextIdx: startIdx };
    }

    const clauses: string[] = [];
    const params: any[] = [];
    let idx = startIdx;

    for (const [key, val] of Object.entries(filters)) {
      if (val === undefined) continue;

      const col = `"${key}"`;

      if (val === null) {
        clauses.push(`${col} IS NULL`);
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        if ('contains' in val && val.contains !== undefined) {
          clauses.push(`${col} ILIKE $${idx++}`);
          params.push(`%${val.contains}%`);
        } else if ('not' in val) {
          if (val.not === null) {
            clauses.push(`${col} IS NOT NULL`);
          } else {
            clauses.push(`${col} <> $${idx++}`);
            params.push(val.not);
          }
        } else if ('in' in val && Array.isArray(val.in)) {
          if (val.in.length === 0) {
            clauses.push('1 = 0');
          } else {
            clauses.push(`${col} = ANY($${idx++})`);
            params.push(val.in);
          }
        } else if ('notIn' in val && Array.isArray(val.notIn)) {
          if (val.notIn.length > 0) {
            clauses.push(`${col} != ALL($${idx++})`);
            params.push(val.notIn);
          }
        } else if ('lt' in val) {
          clauses.push(`${col} < $${idx++}`);
          params.push(val.lt);
        } else if ('lte' in val) {
          clauses.push(`${col} <= $${idx++}`);
          params.push(val.lte);
        } else if ('gt' in val) {
          clauses.push(`${col} > $${idx++}`);
          params.push(val.gt);
        } else if ('gte' in val) {
          clauses.push(`${col} >= $${idx++}`);
          params.push(val.gte);
        }
      } else {
        if (key === 'owner') {
          clauses.push(`(${col}::text = $${idx} OR ${col}->>0 = $${idx} OR ${col} = to_jsonb($${idx}::text))`);
          params.push(String(val));
          idx++;
        } else {
          clauses.push(`${col} = $${idx++}`);
          params.push(val);
        }
      }
    }

    return {
      where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
      nextIdx: idx,
    };
  }

  return {
    async findAll(params: FindAllParams = {}): Promise<{ records: T[]; hasMore: boolean }> {
      const { filters, sort, offset = 0, limit = 500, fields } = params;
      const selectCols = fields && fields.length > 0 ? fields.map((f) => `"${f}"`).join(', ') : '*';
      const { where, params: queryParams, nextIdx } = buildWhere(filters, 1);

      let orderClause = '';
      if (sort && Array.isArray(sort) && sort.length > 0) {
        const allowedCols = SORTABLE_COLUMNS_BY_TABLE[tableName];
        const parts: string[] = [];

        for (const s of sort) {
          if (!s || typeof s.field !== 'string') continue;
          const field = s.field.trim();

          // Reject fields not explicitly present in the table's allowlist
          if (allowedCols && !allowedCols.has(field)) {
            continue;
          }

          // Defensive check against special characters or injection attempts
          if (!/^[a-zA-Z0-9_]+$/.test(field)) {
            continue;
          }

          // Accept only 'ASC' or 'DESC'
          const rawDir = String(s.direction || '').toUpperCase().trim();
          const dir = rawDir === 'DESC' ? 'DESC' : 'ASC';

          parts.push(`"${field}" ${dir}`);
        }

        if (parts.length > 0) {
          orderClause = `ORDER BY ${parts.join(', ')}`;
        }
      }

      const sql = `
        SELECT ${selectCols}
        FROM ${table}
        ${where}
        ${orderClause}
        LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
      `;

      queryParams.push(limit + 1, offset);
      const res = await query(sql, queryParams);
      const rows = res.rows as T[];
      const hasMore = rows.length > limit;
      const records = hasMore ? rows.slice(0, limit) : rows;

      return { records, hasMore };
    },

    async findOne(params: FindOneParams): Promise<T | undefined> {
      if (!params || (!params.id && !params.filters)) {
        return undefined;
      }

      const filters: RecordFilters = { ...(params.filters || {}) };
      if (params.id) {
        filters.id = params.id;
      }

      const { records } = await this.findAll({ filters, limit: 1, fields: params.fields });
      return records[0];
    },

    async create({ record }: { record: Record<string, any> }): Promise<T> {
      const keys = Object.keys(record);
      const id = record.id || globalThis.crypto?.randomUUID?.() || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const allKeys = keys.includes('id') ? keys : ['id', ...keys];
      const allValues = allKeys.map((k) => (k === 'id' ? id : record[k]));

      const cols = allKeys.map((k) => `"${k}"`).join(', ');
      const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(', ');

      const sanitizedValues = allValues.map((v, i) => sanitizeColValue(allKeys[i], v));

      const sql = `
        INSERT INTO ${table} (${cols})
        VALUES (${placeholders})
        RETURNING *
      `;

      const res = await query(sql, sanitizedValues);
      return res.rows[0] as T;
    },

    async update({ id, record }: { id: string; record: Record<string, any> }): Promise<{ id: string; fields: Partial<T> }> {
      const keys = Object.keys(record);
      if (keys.length === 0) {
        return { id, fields: {} as Partial<T> };
      }

      const setClauses: string[] = [];
      const params: any[] = [];
      let idx = 1;

      for (const k of keys) {
        setClauses.push(`"${k}" = $${idx++}`);
        params.push(sanitizeColValue(k, record[k]));
      }

      params.push(id);
      const sql = `
        UPDATE ${table}
        SET ${setClauses.join(', ')}
        WHERE "id" = $${idx}
        RETURNING *
      `;

      const res = await query(sql, params);
      return { id, fields: res.rows[0] as Partial<T> };
    },

    async delete({ id }: { id: string }): Promise<{ success: boolean; id: string }> {
      await query(`DELETE FROM ${table} WHERE "id" = $1`, [id]);
      return { success: true, id };
    },

    async bulkCreate({ records }: { records: Array<Record<string, any>> }): Promise<{ success: boolean; records: T[] }> {
      const created: T[] = [];
      for (const rec of records) {
        const item = await this.create({ record: rec });
        created.push(item);
      }
      return { success: true, records: created };
    },
  };
}

export function createPgSqlClient() {
  return async ({ query: sqlQuery, params = [] }: { query: string; params?: any[] }) => {
    const res = await query(sqlQuery, params);
    return {
      rows: res.rows,
      columns: res.fields.map((f) => ({ name: f.name, originalName: f.name })),
      rowCount: res.rowCount ?? res.rows.length,
      truncated: false,
    };
  };
}
