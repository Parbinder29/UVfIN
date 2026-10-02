export interface CsvColumn<T> {
  label: string
  value: (row: T) => string | number | null | undefined
}

/**
 * Build a CSV string. Cells that a spreadsheet would treat as a formula
 * (starting with = + - @, tab or CR, even after leading spaces) are prefixed with a quote so opening the
 * export in Excel can't run injected formulas. Numbers are left untouched.
 */
export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'number') return String(v)
    let s = String(v)
    if (/^\s*[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(','))
  // BOM so Excel opens UTF-8 (₹, names) correctly.
  return '﻿' + [header, ...body].join('\r\n')
}

/** Browser-only: trigger a download of CSV text. */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
