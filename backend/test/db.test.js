import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';

const { toPostgresPlaceholders } = await import('../src/db.js');

test('converts lookup parameters without changing SQL string literals', () => {
  const sql = `SELECT *
                 FROM up_emp
                WHERE MERITLIST_ID = ?
                  AND CLASS_ID = ?
                  AND RIGHT(REPLACE(REPLACE(PHONE, ' ', ''), '+', ''), 11) = ?`;

  assert.equal(
    toPostgresPlaceholders(sql),
    `SELECT *
                 FROM up_emp
                WHERE MERITLIST_ID = $1
                  AND CLASS_ID = $2
                  AND RIGHT(REPLACE(REPLACE(PHONE, ' ', ''), '+', ''), 11) = $3`
  );
});

test('ignores question marks in quoted text, identifiers and comments', () => {
  const sql = `SELECT '?', "?" FROM example -- ?\nWHERE value = ? /* ? */`;

  assert.equal(
    toPostgresPlaceholders(sql),
    `SELECT '?', "?" FROM example -- ?\nWHERE value = $1 /* ? */`
  );
});

test('ignores question marks in PostgreSQL dollar-quoted text', () => {
  assert.equal(
    toPostgresPlaceholders('SELECT $$?$$, $tag$?$tag$, ?'),
    'SELECT $$?$$, $tag$?$tag$, $1'
  );
});
