// 查询只读守卫：剥注释 → 多语句拒绝 → 首词白名单 → 危险词黑名单
// 见 spec Edge cases：个人工具接受解析拦截的非硬边界风险，操作日志可追溯

const DANGEROUS_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
  'GRANT', 'REVOKE', 'MERGE', 'RENAME', 'COMMENT', 'FLUSH', 'EXEC',
  'EXECUTE', 'CALL', 'REPLACE', 'DECLARE', 'BEGIN'
]

/** 剥离行注释 -- 与块注释 /* *\/ */
export function stripComments(sql: string): string {
  return sql
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/** 提取首个有效词（去空白与包裹括号，防止 (SELECT ...) 绕过） */
export function firstKeyword(sql: string): string {
  const cleaned = stripComments(sql).trim()
  // 去掉开头的左括号与空白，识别括号内首个词
  const m = cleaned.replace(/^[(\s]+/, '').match(/^[A-Za-z]+/)
  return m ? m[0].toUpperCase() : ''
}

export interface GuardResult {
  allowed: boolean
  reason?: string
}

/**
 * 检查一条 SQL 是否放行。
 * @returns allowed=true 表示放行；否则给出拒绝原因
 */
export function guardSql(sql: string): GuardResult {
  const stripped = stripComments(sql).trim()
  if (!stripped) return { allowed: false, reason: 'SQL 为空' }

  // 多语句拒绝：分号出现在末尾之外即视为多条语句
  const bodyLeft = stripped.replace(/;$/, '')
  if (bodyLeft.includes(';')) {
    return { allowed: false, reason: '仅允许单条查询语句' }
  }

  // MySQL 需声明 ; 结尾合法，去除后再判
  const kw = firstKeyword(bodyLeft)
  if (kw !== 'SELECT' && kw !== 'WITH') {
    return { allowed: false, reason: `仅允许 SELECT/WITH 查询，检测到关键字 ${kw || '(无)'}` }
  }

  // 危险词整词扫描（排除 SELECT 内出现的合法列名不误伤：只查高风险 DDL/DML 动词）
  const upper = bodyLeft.toUpperCase()
  const hit = DANGEROUS_KEYWORDS.find((w) => new RegExp(`(^|[^A-Z_])${w}([^A-Z_]|$)`).test(upper))
  if (hit) {
    return { allowed: false, reason: `检测到危险关键字 ${hit}` }
  }

  return { allowed: true }
}

/** 提取形如 :date / :emp_no 的参数名（去重，保序） */
export function extractParams(sql: string): string[] {
  const stripped = stripComments(sql)
  const re = /:([A-Za-z_][A-Za-z0-9_]*)/g
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped)) !== null) {
    // 排除 MySQL 的 := 赋值（个人工具场景罕见，忽略）
    if (!seen.has(m[1])) {
      seen.add(m[1])
      out.push(m[1])
    }
  }
  return out
}