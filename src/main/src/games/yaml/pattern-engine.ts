/**
 * Pattern matching engine for the game adaptor YAML format.
 *
 * Implements the pattern language from FORMAT.md as a pure TypeScript module.
 */

import type { RuleDef, MapDef } from './types';

// ── Types ────────────────────────────────────────────────────────────

export interface EvaluationResult {
  mappings: Array<{
    source: string;
    destination: string;
    ruleName: string;
    ruleIndex: number;
  }>;
  unmatched: string[];
  ruleStats: Array<{ name: string; matchCount: number }>;
}

type Captures = Record<string, string>;

// ── Pattern compilation ──────────────────────────────────────────────

interface PatternSegment {
  type:
    | 'literal'       // e.g. "Data"
    | 'wildcard'      // *
    | 'globstar'      // **
    | 'capture'       // {name}
    | 'rest'          // {name...}
    | 'alternation'   // {a,b,c}
    | 'constrained'   // {name:a,b}
    | 'stem_capture'  // {name}.ext
    | 'prefix_wild'   // prefix*
    | 'ext_match';    // *.ext
  value?: string;
  name?: string;
  options?: string[];
  ext?: string;
  prefix?: string;
}

function parsePatternSegment(seg: string): PatternSegment {
  if (seg === '**') return { type: 'globstar' };
  if (seg === '*') return { type: 'wildcard' };

  // *.{ext1,ext2,...} — extension alternation (must check before generic *.ext)
  if (seg.startsWith('*.{') && seg.endsWith('}')) {
    const inner = seg.slice(3, -1);
    return { type: 'ext_match', ext: inner };
  }

  // *.ext pattern
  if (seg.startsWith('*.')) {
    return { type: 'ext_match', ext: seg.slice(2) };
  }

  // prefix* pattern (e.g. dlc*)
  if (seg.endsWith('*') && !seg.startsWith('{')) {
    return { type: 'prefix_wild', prefix: seg.slice(0, -1) };
  }

  // Brace patterns
  if (seg.startsWith('{') && seg.includes('}')) {
    const closeBrace = seg.indexOf('}');
    const inner = seg.slice(1, closeBrace);
    const afterBrace = seg.slice(closeBrace + 1);

    // Rest capture: {name...}
    if (inner.endsWith('...')) {
      return { type: 'rest', name: inner.slice(0, -3) };
    }

    // Check for commas or colon
    if (inner.includes(':')) {
      // Constrained capture: {name:a,b,c}
      const colonIdx = inner.indexOf(':');
      const name = inner.slice(0, colonIdx);
      const options = inner.slice(colonIdx + 1).split(',');
      if (afterBrace) {
        // For patterns like {name:a,b}.ext — but constrained captures don't typically have extensions
        return { type: 'constrained', name, options };
      }
      return { type: 'constrained', name, options };
    }

    if (inner.includes(',')) {
      // Bare alternation: {a,b,c}
      const options = inner.split(',');

      // Handle *.{pak,ucas} — the ext_match is handled at a higher level
      if (afterBrace) {
        return { type: 'alternation', options };
      }
      return { type: 'alternation', options };
    }

    // Simple capture: {name} or {name}.ext
    if (afterBrace.startsWith('.')) {
      // Stem capture: {name}.ext
      return { type: 'stem_capture', name: inner, ext: afterBrace.slice(1) };
    }

    return { type: 'capture', name: inner };
  }

  return { type: 'literal', value: seg };
}

interface CompiledPattern {
  segments: PatternSegment[];
  raw: string;
}

export function compilePattern(pattern: string): CompiledPattern {
  const segments = pattern.split('/').map(parsePatternSegment);
  return { segments, raw: pattern };
}

// ── Segment matching ─────────────────────────────────────────────────

function matchSegment(
  seg: PatternSegment,
  value: string,
  captures: Captures,
): boolean {
  const lc = value.toLowerCase();

  switch (seg.type) {
    case 'literal':
      return lc === seg.value!.toLowerCase();

    case 'wildcard':
      return true;

    case 'capture':
      captures[seg.name!] = value;
      return true;

    case 'alternation': {
      return seg.options!.some((opt) => lc === opt.toLowerCase());
    }

    case 'constrained': {
      const match = seg.options!.find((opt) => lc === opt.toLowerCase());
      if (match) {
        captures[seg.name!] = value;
        return true;
      }
      return false;
    }

    case 'ext_match': {
      // Handle *.{pak,ucas,utoc} — ext may contain commas
      const exts = seg.ext!.split(',').map((e) => e.trim().toLowerCase());
      const dotIdx = value.lastIndexOf('.');
      if (dotIdx === -1) return false;
      const fileExt = value.slice(dotIdx + 1).toLowerCase();
      return exts.includes(fileExt);
    }

    case 'stem_capture': {
      const ext = '.' + seg.ext!.toLowerCase();
      if (!lc.endsWith(ext)) return false;
      captures[seg.name!] = value.slice(0, value.length - ext.length);
      return true;
    }

    case 'prefix_wild':
      return lc.startsWith(seg.prefix!.toLowerCase());

    default:
      return false;
  }
}

// ── Full path matching ───────────────────────────────────────────────

function matchRecursive(
  patternSegs: PatternSegment[],
  pi: number,
  pathSegs: string[],
  si: number,
  captures: Captures,
): Captures | null {
  // Both exhausted — match
  if (pi === patternSegs.length && si === pathSegs.length) {
    return captures;
  }

  // Pattern exhausted but path remains — no match
  if (pi === patternSegs.length) return null;

  const seg = patternSegs[pi];

  // Rest capture: consume all remaining segments
  if (seg.type === 'rest') {
    if (si >= pathSegs.length) {
      // Rest can match zero segments only if it's the last pattern segment
      if (pi === patternSegs.length - 1) {
        captures[seg.name!] = '';
        return captures;
      }
      return null;
    }
    captures[seg.name!] = pathSegs.slice(si).join('/');
    // Rest should be the last segment in the pattern
    if (pi === patternSegs.length - 1) {
      return captures;
    }
    return null;
  }

  // Globstar: try matching zero or more segments
  if (seg.type === 'globstar') {
    // Try consuming 0, 1, 2, ... segments
    for (let skip = 0; skip <= pathSegs.length - si; skip++) {
      const result = matchRecursive(
        patternSegs,
        pi + 1,
        pathSegs,
        si + skip,
        { ...captures },
      );
      if (result) return result;
    }
    return null;
  }

  // Path exhausted but pattern remains — no match
  if (si === pathSegs.length) return null;

  // Handle compound segments: e.g. {file}.{ext:pak,ucas} -> "{file}" + ".{ext:pak,ucas}"
  // We need to handle cases where a pattern segment like "{file}.{ext}" involves two captures in one path segment.
  // For now we handle the simple case where the pattern segment contains a dot with a sub-pattern.
  if (seg.type === 'literal' || seg.type === 'wildcard' || seg.type === 'capture' ||
      seg.type === 'alternation' || seg.type === 'constrained' || seg.type === 'ext_match' ||
      seg.type === 'stem_capture' || seg.type === 'prefix_wild') {
    const localCaptures = { ...captures };
    if (matchSegment(seg, pathSegs[si], localCaptures)) {
      return matchRecursive(patternSegs, pi + 1, pathSegs, si + 1, localCaptures);
    }
    return null;
  }

  return null;
}

// ── Extended segment matching for compound patterns ──────────────────
// Handle patterns like "{file}.{ext:pak,ucas,utoc}" which have two captures in one segment.
// We re-parse the raw pattern for these cases.

function matchCompoundSegment(rawSegment: string, value: string, captures: Captures): boolean {
  // Check for patterns like {file}.{ext:pak,ucas,utoc} or {file}.{ext}
  const compoundMatch = rawSegment.match(/^\{(\w+)\}\.\{(\w+)(?::([^}]+))?\}$/);
  if (compoundMatch) {
    const [, stemName, extName, extConstraints] = compoundMatch;
    const dotIdx = value.lastIndexOf('.');
    if (dotIdx === -1) return false;

    const stem = value.slice(0, dotIdx);
    const ext = value.slice(dotIdx + 1);

    if (extConstraints) {
      const allowed = extConstraints.split(',').map((s) => s.trim().toLowerCase());
      if (!allowed.includes(ext.toLowerCase())) return false;
    }

    captures[stemName] = stem;
    captures[extName] = ext;
    return true;
  }

  return false;
}

// Enhanced pattern compilation that handles compound segments
export function compilePatternEnhanced(pattern: string): CompiledPattern {
  const rawSegments = pattern.split('/');
  const segments: PatternSegment[] = [];

  for (const raw of rawSegments) {
    // Check for compound capture patterns like {file}.{ext:pak,ucas,utoc}
    if (/^\{\w+\}\.\{\w+(?::[^}]+)?\}$/.test(raw)) {
      // Store as a special "compound" via ext_match + custom handling
      segments.push({
        type: 'literal', // We'll override matching for this
        value: raw, // Store raw for compound matching
      });
    } else {
      segments.push(parsePatternSegment(raw));
    }
  }

  return { segments, raw: pattern };
}

// Override the match for compound literals
export function matchPathEnhanced(
  pattern: CompiledPattern,
  pathSegments: string[],
  existingCaptures: Captures = {},
): Captures | null {
  const captures: Captures = { ...existingCaptures };
  return matchRecursiveEnhanced(pattern.segments, 0, pathSegments, 0, captures, pattern.raw.split('/'));
}

function matchRecursiveEnhanced(
  patternSegs: PatternSegment[],
  pi: number,
  pathSegs: string[],
  si: number,
  captures: Captures,
  rawSegs: string[],
): Captures | null {
  if (pi === patternSegs.length && si === pathSegs.length) return captures;
  if (pi === patternSegs.length) return null;

  const seg = patternSegs[pi];

  if (seg.type === 'rest') {
    if (si >= pathSegs.length) {
      if (pi === patternSegs.length - 1) {
        captures[seg.name!] = '';
        return captures;
      }
      return null;
    }
    captures[seg.name!] = pathSegs.slice(si).join('/');
    if (pi === patternSegs.length - 1) return captures;
    return null;
  }

  if (seg.type === 'globstar') {
    for (let skip = 0; skip <= pathSegs.length - si; skip++) {
      const result = matchRecursiveEnhanced(patternSegs, pi + 1, pathSegs, si + skip, { ...captures }, rawSegs);
      if (result) return result;
    }
    return null;
  }

  if (si === pathSegs.length) return null;

  const localCaptures = { ...captures };

  // Try compound match first for literal segments that look compound
  if (seg.type === 'literal' && rawSegs[pi] && /^\{\w+\}\.\{\w+(?::[^}]+)?\}$/.test(rawSegs[pi])) {
    if (matchCompoundSegment(rawSegs[pi], pathSegs[si], localCaptures)) {
      return matchRecursiveEnhanced(patternSegs, pi + 1, pathSegs, si + 1, localCaptures, rawSegs);
    }
    return null;
  }

  if (matchSegment(seg, pathSegs[si], localCaptures)) {
    return matchRecursiveEnhanced(patternSegs, pi + 1, pathSegs, si + 1, localCaptures, rawSegs);
  }

  return null;
}

// ── Template expansion ───────────────────────────────────────────────

function expandTemplate(
  template: string,
  captures: Captures,
  folders: Record<string, string>,
): string {
  // First resolve folder references, then captures
  let result = template;

  // Expand variables — iterate multiple times to resolve nested references
  for (let i = 0; i < 5; i++) {
    const prev = result;
    result = result.replace(/\{(\w+)\}/g, (match, name) => {
      if (name in captures) return captures[name];
      if (name in folders) return folders[name];
      return match;
    });
    if (result === prev) break;
  }

  return result;
}

// ── Root resolution ──────────────────────────────────────────────────

interface RootMatch {
  root: string;
  captures: Captures;
}

function resolveRoot(
  rootPattern: string,
  files: string[],
  existingCaptures: Captures = {},
  multi: boolean = false,
): RootMatch[] {
  const compiled = compilePatternEnhanced(rootPattern);
  const matches: RootMatch[] = [];

  for (const file of files) {
    const segments = file.split('/');
    const caps = matchPathEnhanced(compiled, segments, { ...existingCaptures });
    if (caps) {
      // {root} is the directory containing the matched file
      const rootDir = segments.slice(0, -1).join('/');
      caps['root'] = rootDir;
      matches.push({ root: rootDir, captures: caps });
      if (!multi) break;
    }
  }

  return matches;
}

// ── When condition evaluation ────────────────────────────────────────

function evaluateWhen(
  conditions: string[],
  files: string[],
  captures: Captures,
): boolean {
  for (const cond of conditions) {
    const negated = cond.startsWith('!');
    const patternStr = negated ? cond.slice(1) : cond;

    // Expand captures in the condition pattern
    const expandedPattern = patternStr.replace(/\{(\w+)\}/g, (match, name) => {
      if (name in captures) return captures[name];
      return match;
    });

    const compiled = compilePatternEnhanced(expandedPattern);
    const found = files.some((f) => {
      const segs = f.split('/');
      return matchPathEnhanced(compiled, segs) !== null;
    });

    if (negated && found) return false;
    if (!negated && !found) return false;
  }

  return true;
}

// ── Map application ──────────────────────────────────────────────────

function applyMap(
  map: MapDef,
  captures: Captures,
): Captures | null {
  const result = { ...captures };

  for (const [arrow, table] of Object.entries(map)) {
    const [captureNameRaw, variableNameRaw] = arrow.split('->').map((s) => s.trim());
    const capturedValue = result[captureNameRaw];
    if (capturedValue === undefined) return null;

    const lcValue = capturedValue.toLowerCase();
    let mapped: string | undefined;
    for (const [key, val] of Object.entries(table)) {
      if (key.toLowerCase() === lcValue) {
        mapped = val;
        break;
      }
    }

    if (mapped === undefined) return null; // No mapping → skip file
    result[variableNameRaw] = mapped;
  }

  return result;
}

// ── Main evaluation ──────────────────────────────────────────────────

export function evaluateRules(
  rules: RuleDef[],
  fileList: string[],
  folders: Record<string, string> = {},
): EvaluationResult {
  // Filter out directory entries
  const files = fileList.filter((f) => !f.endsWith('/'));

  const mappings: EvaluationResult['mappings'] = [];
  const matchedFiles = new Set<string>();
  const ruleStats = rules.map((r) => ({ name: r.name, matchCount: 0 }));

  for (let ri = 0; ri < rules.length; ri++) {
    const rule = rules[ri];

    // Check when conditions with empty captures first (root captures added later)
    // We'll check when for each root match separately if root is present

    if (rule.root) {
      // Resolve root
      const rootMatches = resolveRoot(rule.root, files, {}, rule.multi || false);
      if (rootMatches.length === 0) continue;

      for (const rootMatch of rootMatches) {
        // Check when with root captures
        if (rule.when && !evaluateWhen(rule.when, files, rootMatch.captures)) {
          continue;
        }

        const fromPattern = compilePatternEnhanced(
          expandTemplate(rule.from, rootMatch.captures, {}),
        );

        for (const file of files) {
          if (matchedFiles.has(file)) continue;

          const segments = file.split('/');
          const caps = matchPathEnhanced(fromPattern, segments, { ...rootMatch.captures });
          if (!caps) continue;

          // Check excludes
          if (rule.exclude) {
            const excluded = rule.exclude.some((exPat) => {
              const exCompiled = compilePatternEnhanced(exPat);
              return matchPathEnhanced(exCompiled, segments) !== null;
            });
            if (excluded) continue;
          }

          // Apply map
          let finalCaptures = caps;
          if (rule.map) {
            const mapped = applyMap(rule.map, caps);
            if (!mapped) continue;
            finalCaptures = mapped;
          }

          const destination = expandTemplate(rule.to, finalCaptures, folders);
          mappings.push({
            source: file,
            destination,
            ruleName: rule.name,
            ruleIndex: ri,
          });
          matchedFiles.add(file);
          ruleStats[ri].matchCount++;
        }
      }
    } else {
      // No root — straightforward matching
      if (rule.when && !evaluateWhen(rule.when, files, {})) {
        continue;
      }

      const fromPattern = compilePatternEnhanced(rule.from);

      for (const file of files) {
        if (matchedFiles.has(file)) continue;

        const segments = file.split('/');
        const caps = matchPathEnhanced(fromPattern, segments);
        if (!caps) continue;

        // Check excludes
        if (rule.exclude) {
          const excluded = rule.exclude.some((exPat) => {
            const exCompiled = compilePatternEnhanced(exPat);
            return matchPathEnhanced(exCompiled, segments) !== null;
          });
          if (excluded) continue;
        }

        // Apply map
        let finalCaptures = caps;
        if (rule.map) {
          const mapped = applyMap(rule.map, caps);
          if (!mapped) continue;
          finalCaptures = mapped;
        }

        const destination = expandTemplate(rule.to, finalCaptures, folders);
        mappings.push({
          source: file,
          destination,
          ruleName: rule.name,
          ruleIndex: ri,
        });
        matchedFiles.add(file);
        ruleStats[ri].matchCount++;
      }
    }
  }

  const unmatched = files.filter((f) => !matchedFiles.has(f));

  return { mappings, unmatched, ruleStats };
}
