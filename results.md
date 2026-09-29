# Benchmark

## Method

This benchmark is running in the renderer and the task is recursively enumerating and counting all files in a PNPM store directory which contains thousands of little files.

The goal is to figure out how much overhead IPC brings to filesystem operations by comparing the IPC results that need a roundtrip between the renderer and the main process vs directly using the filesystem implementation.

Both arms execute identical backend work; only the transport differs. The IPC arm uses the batched pull protocol: main holds the directory iterator behind a handle, the renderer pulls `ENUMERATE_BATCH_SIZE` entries per invoke until done.

## Results

- `duration` is calculated using `performance.now()` and is represented in milliseconds.
- `durationPerEntry` is simply `duration / numFiles`

```json
{"fsType":"ipc","iteration":0,"duration":3826.0999999996275,"numFiles":86013,"durationPerEntry":0.04448281073790738}
{"fsType":"ipc","iteration":1,"duration":3692.7000000001863,"numFiles":86013,"durationPerEntry":0.042931882389873464}
{"fsType":"ipc","iteration":2,"duration":3740.2999999998137,"numFiles":86013,"durationPerEntry":0.04348528710776062}
{"fsType":"ipc","iteration":3,"duration":3737.7000000001863,"numFiles":86013,"durationPerEntry":0.04345505911897255}
{"fsType":"ipc","iteration":4,"duration":3700.7999999998137,"numFiles":86013,"durationPerEntry":0.04302605420110697}
{"fsType":"ipc","avg":3739.5199999999254,"q50":3737.7000000001863,"iterations":5}

{"fsType":"node","iteration":0,"duration":3326.2999999998137,"numFiles":86013,"durationPerEntry":0.03867206120004899}
{"fsType":"node","iteration":1,"duration":3196.5999999996275,"numFiles":86013,"durationPerEntry":0.03716414960528789}
{"fsType":"node","iteration":2,"duration":3402,"numFiles":86013,"durationPerEntry":0.03955216071989118}
{"fsType":"node","iteration":3,"duration":3271,"numFiles":86013,"durationPerEntry":0.03802913513073605}
{"fsType":"node","iteration":4,"duration":3334.5,"numFiles":86013,"durationPerEntry":0.03876739562624255}
{"fsType":"node","avg":3306.079999999888,"q50":3326.2999999998137,"iterations":5}
```

The IPC method is `11%` slower compared to directly using the filesystem implementation. The overhead of using IPC is `12.4%` expressed against the fast baseline instead of the slower run:

```
3737.7ms - 3326.3ms = 411.4ms
411.4ms / 3737.7ms = 11%
411.4ms / 3326.3ms = 12.36%
```

For the IPC we send `512` results per batch, so `86013` files take `86013 / 512 ≈ 168` pulls. The absolute overhead of `411.4ms` results in `411.4ms / 168 = 2.45ms` per pull.

Increasing the batch size from `512` to `4096` produces these results:

```json
{"fsType":"ipc","iteration":0,"duration":3837.9000000003725,"numFiles":86013,"durationPerEntry":0.04461999930243536}
{"fsType":"ipc","iteration":1,"duration":3696.0999999996275,"numFiles":86013,"durationPerEntry":0.042971411298287784}
{"fsType":"ipc","iteration":2,"duration":3800.2999999998137,"numFiles":86013,"durationPerEntry":0.04418285607989273}
{"fsType":"ipc","iteration":3,"duration":3809,"numFiles":86013,"durationPerEntry":0.044284003580854055}
{"fsType":"ipc","iteration":4,"duration":3607.7999999998137,"numFiles":86013,"durationPerEntry":0.041944822294302186}
{"fsType":"ipc","avg":3750.2199999999257,"q50":3800.2999999998137,"iterations":5}
```

Raising the batch size reduces pulls from `86013 / 512 ≈ 168` to `86013 / 4096 ≈ 21` while the overhead stays flat: q50 `3737.7ms` vs `3800.3ms`, within run-to-run noise. If roundtrips dominated, the overhead would have collapsed ~8x at the larger batch; it did not. Overhead is invariant to batch size and roundtrip count, and proportional to entry count.

Instead, overhead is payload-proportional: main-side wire conversion, structured clone of the batch, and preload-side rehydration. Besides the Electron IPC structured clone, we can change the payload shape and hydration methods to improve performance, bringing IPC closer to direct access.

Simpler types over IPC bring our results much closer. Instead of including `stat` results with `includeStatus: true` we can turn that off to compare when IPC only needs to transport the serialized `QualifiedPath` values:

```json
{"fsType":"ipc","iteration":0,"duration":2377.199999999255,"numFiles":86013,"durationPerEntry":0.027637682675865916}
{"fsType":"ipc","iteration":1,"duration":2346.100000000559,"numFiles":86013,"durationPerEntry":0.027276109425325924}
{"fsType":"ipc","iteration":2,"duration":2356.5999999996275,"numFiles":86013,"durationPerEntry":0.027398183995438218}
{"fsType":"ipc","iteration":3,"duration":2230.4000000003725,"numFiles":86013,"durationPerEntry":0.02593096392406232}
{"fsType":"ipc","iteration":4,"duration":2339.7999999998137,"numFiles":86013,"durationPerEntry":0.02720286468324339}
{"fsType":"ipc","avg":2330.0199999999254,"q50":2346.100000000559,"iterations":5}

{"fsType":"node","iteration":0,"duration":1908.2000000001863,"numFiles":86013,"durationPerEntry":0.022185018543710674}
{"fsType":"node","iteration":1,"duration":2266.4000000003725,"numFiles":86013,"durationPerEntry":0.026349505307341595}
{"fsType":"node","iteration":2,"duration":2293.7000000001863,"numFiles":86013,"durationPerEntry":0.026666899189659542}
{"fsType":"node","iteration":3,"duration":2332.7000000001863,"numFiles":86013,"durationPerEntry":0.027120319021545422}
{"fsType":"node","iteration":4,"duration":2332.9000000003725,"numFiles":86013,"durationPerEntry":0.02712264425145469}
{"fsType":"node","avg":2226.7800000002608,"q50":2293.7000000001863,"iterations":5}
```

This reduces the overhead from `12.4%` to `2.3%` showing that wire shape and rehydration dominate performance. Both of which we control and can optimize.
