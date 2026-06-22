/* eslint-disable perfectionist/sort-imports */
/**
 * Discovery and validation helpers for YAML-backed E2E test cases.
 */
import fs from "node:fs";
import path from "node:path";

import { load as parseYaml } from "js-yaml";
import { z } from "zod";

import { freeUser, premiumUser, type NexusUser } from "../users";

const TEST_CASES_ROOT = path.resolve(import.meta.dirname, "..", "..", "fixtures", "test-cases");

const DATA_DRIVEN_FLOW = "manage-download-and-deploy" as const;

const NEXUS_USERS = {
  free: freeUser,
  premium: premiumUser,
} as const satisfies Record<NexusUserName, NexusUser>;

const REGEXP_FLAGS_PATTERN = /^[dgimsuvy]*$/;

const nexusUserNameSchema = z.enum(["free", "premium"]);
const regexMatcherSchema = z
  .object({
    flags: z.string().regex(REGEXP_FLAGS_PATTERN, "contains unsupported RegExp flags").optional(),
    regex: z.string().min(1),
  })
  .strict();
const textMatcherSchema = z.union([z.string().min(1), regexMatcherSchema]);
const fixturesSchema = z
  .object({
    dynamicExtensionIds: z.array(z.string().min(1)).optional(),
    dynamicGameExtensionId: z.string().min(1).optional(),
    managedGameId: z.string().min(1).optional(),
    nexusUser: nexusUserNameSchema.optional(),
  })
  .strict();
const matrixSchema = z
  .object({
    nexusUser: z.array(nexusUserNameSchema).min(1).optional(),
  })
  .strict();
const dataDrivenCaseSchema = z
  .object({
    deploy: z
      .object({
        expectedFiles: z.array(z.string().min(1)).min(1),
        message: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    download: z
      .object({
        expectedModRow: textMatcherSchema,
        expectedUrl: regexMatcherSchema.optional(),
        missingNxmMessage: z.string().min(1).optional(),
        modUrl: z.string().url(),
      })
      .strict(),
    fixtures: fixturesSchema.optional(),
    flow: z.literal(DATA_DRIVEN_FLOW),
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    matrix: matrixSchema.optional(),
    suite: z.string().min(1),
    title: z.string().min(1),
  })
  .strict();

type ParsedManageDownloadAndDeployCase = z.infer<typeof dataDrivenCaseSchema>;

type NexusUserName = z.infer<typeof nexusUserNameSchema>;
type RegexMatcher = z.infer<typeof regexMatcherSchema>;
type TextMatcher = z.infer<typeof textMatcherSchema>;

interface BaseDataDrivenTestCase {
  /** Flow selector that decides which Playwright runner registers this case. */
  flow: string;
  /** Game id derived from `fixtures/test-cases/games/<gameId>/`. */
  gameId: string;
  /** Stable case id used in generated Playwright titles. */
  id: string;
  /** Optional matrix configuration that expands this case into variants. */
  matrix?: ParsedManageDownloadAndDeployCase["matrix"];
  /** Vortex fixture options resolved from the YAML file and game folder. */
  resolvedFixtures: ResolvedDataDrivenFixtures;
  /** Absolute path to the YAML source file. */
  sourcePath: string;
  /** Playwright suite name for this case. */
  suite: string;
  /** Playwright test title before generated case/user suffixes are added. */
  title: string;
}

/** Describes one validated `manage-download-and-deploy` YAML case before matrix expansion. */
export interface ManageDownloadAndDeployTestCase extends BaseDataDrivenTestCase {
  /** Flow-specific deploy expectations, when this case verifies deployed files. */
  deploy?: ParsedManageDownloadAndDeployCase["deploy"];
  /** Flow-specific Nexus Mod Manager download configuration. */
  download: ParsedManageDownloadAndDeployCase["download"];
  /** Flow selector for the Mod Manager download and optional deploy runner. */
  flow: typeof DATA_DRIVEN_FLOW;
}

/** Union of validated YAML case types. Add future flow case types here. */
export type DataDrivenTestCase = ManageDownloadAndDeployTestCase;

/** Resolved Vortex fixture options for one YAML-backed test case. */
interface ResolvedDataDrivenFixtures {
  /** Dynamic extensions copied into the isolated Vortex instance before launch. */
  dynamicExtensionIds: string[];
  /** Dynamic game extension copied into the isolated Vortex instance before launch. */
  dynamicGameExtensionId?: string;
  /** Managed fake game id used by the Vortex fixture layer. */
  managedGameId: string;
  /** Nexus user role used when no matrix overrides the role. */
  nexusUser?: NexusUserName;
}

/** One concrete Playwright test variant after YAML matrix expansion. */
type DataDrivenTestVariant<TCase extends DataDrivenTestCase = DataDrivenTestCase> = TCase & {
  /** Nexus user role for this concrete variant. */
  nexusUser: NexusUserName;
  /** Whether the variant came from a YAML matrix. */
  usesMatrix: boolean;
};

/**
 * Finds, parses, validates, and normalizes all YAML E2E cases.
 *
 * @param rootDir Directory containing recursive `games/<gameId>` YAML case files.
 * @returns Validated test cases sorted by source path.
 * @throws Error when a YAML file cannot be read.
 * @throws Error when a YAML file contains invalid YAML.
 * @throws Error when a case fails validation, including when it sets both `fixtures.nexusUser` and `matrix.nexusUser`.
 * @throws Error when a case is outside `games/<gameId>/` or case ids are duplicated.
 */
export function loadDataDrivenTestCases(rootDir: string = TEST_CASES_ROOT): DataDrivenTestCase[] {
  const cases = findYamlFiles(rootDir).map((filePath) => loadDataDrivenTestCase(filePath, rootDir));
  assertUniqueCaseIds(cases);
  return cases;
}

/**
 * Expands a validated YAML case into runnable Playwright variants.
 *
 * @param testCase Case to expand.
 * @returns One variant per matrix row, or a single variant using the case fixture role.
 * @throws Error when the case has duplicate matrix user roles.
 */
export function expandDataDrivenCase<TCase extends DataDrivenTestCase>(
  testCase: TCase,
): DataDrivenTestVariant<TCase>[] {
  const matrixUsers = testCase.matrix?.nexusUser;
  const users = matrixUsers ?? [testCase.resolvedFixtures.nexusUser ?? "free"];
  const uniqueUsers = [...new Set(users)];
  if (uniqueUsers.length !== users.length) {
    throw new Error(`Duplicate nexusUser entries in matrix: ${testCase.sourcePath}`);
  }

  return uniqueUsers.map((nexusUser) => ({
    ...testCase,
    nexusUser,
    usesMatrix: matrixUsers !== undefined,
  }));
}

/**
 * Converts a YAML text matcher into a Playwright text matcher.
 *
 * @param matcher String or regex matcher from YAML.
 * @param sourcePath YAML source file used in validation errors.
 * @param fieldName Field name used in validation errors.
 * @returns A string or compiled RegExp for Playwright locators/assertions.
 * @throws Error when the regex cannot be compiled.
 */
export function compileTextMatcher(
  matcher: TextMatcher,
  sourcePath: string,
  fieldName: string,
): string | RegExp {
  if (typeof matcher === "string") return matcher;
  return compileRegexMatcher(matcher, sourcePath, fieldName);
}

/**
 * Converts a YAML regex matcher into a RegExp.
 *
 * @param matcher Regex matcher from YAML.
 * @param sourcePath YAML source file used in validation errors.
 * @param fieldName Field name used in validation errors.
 * @returns Compiled regular expression.
 * @throws Error when the regex cannot be compiled.
 */
export function compileRegexMatcher(
  matcher: RegexMatcher,
  sourcePath: string,
  fieldName: string,
): RegExp {
  try {
    return new RegExp(matcher.regex, matcher.flags);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${sourcePath} ${fieldName}: invalid RegExp: ${message}`, { cause: error });
  }
}

/**
 * Resolves a YAML Nexus user role to a fixture user object.
 *
 * @param name Nexus role from a YAML case or matrix variant.
 * @returns Nexus credentials fixture for the requested role.
 */
export function nexusUserForName(name: NexusUserName): NexusUser {
  return NEXUS_USERS[name];
}

/**
 * Builds a stable Playwright title for one YAML-backed variant.
 *
 * @param variant Concrete test variant.
 * @returns Title with grep-friendly case, game, and user suffixes.
 */
export function variantTitle(variant: DataDrivenTestVariant): string {
  const matrixPrefix = variant.usesMatrix ? `${variant.nexusUser} user: ` : "";
  return `${matrixPrefix}${variant.title} @case:${variant.id} @game:${variant.gameId} @user:${variant.nexusUser}`;
}

function loadDataDrivenTestCase(filePath: string, rootDir: string): DataDrivenTestCase {
  const rawCase = parseYamlFile(filePath);
  const parsed = parseCaseSchema(rawCase, filePath);

  if (parsed.matrix?.nexusUser !== undefined && parsed.fixtures?.nexusUser !== undefined) {
    throw new Error(
      `${filePath} cannot set both fixtures.nexusUser and matrix.nexusUser; matrix variants define the user role`,
    );
  }

  const gameId = gameIdFromPath(filePath, rootDir);
  const fixtures = parsed.fixtures ?? {};
  return {
    ...(parsed.deploy === undefined ? {} : { deploy: parsed.deploy }),
    download: parsed.download,
    flow: parsed.flow,
    gameId,
    id: parsed.id,
    ...(parsed.matrix === undefined ? {} : { matrix: parsed.matrix }),
    resolvedFixtures: {
      dynamicExtensionIds: fixtures.dynamicExtensionIds ?? [],
      ...(fixtures.dynamicGameExtensionId === undefined
        ? {}
        : { dynamicGameExtensionId: fixtures.dynamicGameExtensionId }),
      managedGameId: fixtures.managedGameId ?? gameId,
      ...(fixtures.nexusUser === undefined ? {} : { nexusUser: fixtures.nexusUser }),
    },
    sourcePath: filePath,
    suite: parsed.suite,
    title: parsed.title,
  };
}

function parseYamlFile(filePath: string): unknown {
  try {
    return parseYaml(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${filePath}: failed to read or parse YAML: ${message}`, { cause: error });
  }
}

function parseCaseSchema(rawCase: unknown, filePath: string): ParsedManageDownloadAndDeployCase {
  const result = dataDrivenCaseSchema.safeParse(rawCase);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
  throw new Error(`${filePath}: invalid data-driven test case: ${details}`);
}

function findYamlFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];

  const files: string[] = [];
  const visit = (currentDir: string): void => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
        files.push(entryPath);
      }
    }
  };
  visit(rootDir);

  return files.sort((left, right) => left.localeCompare(right));
}

function gameIdFromPath(filePath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, filePath);
  const [namespace, gameId] = relativePath.split(path.sep);
  if (namespace !== "games" || gameId === undefined || gameId.length === 0) {
    throw new Error(`${filePath}: data-driven game cases must live under games/<gameId>/`);
  }
  return gameId;
}

function assertUniqueCaseIds(cases: DataDrivenTestCase[]): void {
  const seen = new Map<string, string>();
  for (const testCase of cases) {
    const existingPath = seen.get(testCase.id);
    if (existingPath !== undefined) {
      throw new Error(
        `Duplicate data-driven case id '${testCase.id}' in ${existingPath} and ${testCase.sourcePath}`,
      );
    }
    seen.set(testCase.id, testCase.sourcePath);
  }
}
