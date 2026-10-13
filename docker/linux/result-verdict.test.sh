#!/usr/bin/env bash
# Usage: docker/linux/result-verdict.test.sh
set -uo pipefail

VERDICT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/result-verdict"
failures=0

expect_verdict() {
    local name="$1" expected_output="$2" expected_status="$3" report="$4"
    local output status
    output="$(printf '%s' "${report}" | "${VERDICT}")"
    status=$?
    if [[ "${output}" == "${expected_output}" && ${status} -eq ${expected_status} ]]; then
        echo "ok   ${name}"
    else
        echo "FAIL ${name}: got ${output} (exit ${status}), expected ${expected_output} (exit ${expected_status})"
        failures=$((failures + 1))
    fi
}

expect_verdict "pass" PASS 0 $'Stardew Valley is managed.\n\nRESULT: PASS\n'
expect_verdict "pass with flags" PASS_WITH_FLAGS 0 $'Flags:\n- Downloads list empty\n\nRESULT: PASS_WITH_FLAGS'
expect_verdict "fail" FAIL 1 $'3 required mods failed.\nRESULT: FAIL\n'
expect_verdict "blocked" BLOCKED 1 $'Sign-in form shown.\nRESULT: BLOCKED\n'
expect_verdict "bold result line" PASS 0 $'All good.\n**RESULT: PASS**\n'
expect_verdict "result line not last" NO_RESULT 1 $'RESULT: PASS\nThen Vortex crashed.\n'
expect_verdict "no result line" NO_RESULT 1 $'Outcome: PASS. Everything worked.\n'
expect_verdict "unknown verdict" NO_RESULT 1 $'RESULT: MOSTLY_PASS\n'
expect_verdict "empty report" NO_RESULT 1 ''

exit $((failures > 0))
