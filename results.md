# Benchmark

## Method

This benchmark is running in the renderer and the task is recurisvely enumerating and counting all files in a PNPM store directory which contains thousands of little files.

The goal is to figure out how much of an overhead does IPC bring to filesystem operations by comparing the IPC results that need to do a roundtrip between the renderer and the main process vs directly using the filesystem implementation.

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

The IPC method is **11% slower** compared to directly using the filesystem implementation. The overhead of using IPC is about 12% expressed against the fast baseline instead of the slower run:

```
3737.7ms - 3326.3ms = 411.4ms
411.4ms / 3737.7ms = 11%
411.4ms / 3326.3ms = 12.36%
```

For the IPC we send `512` results per batch, so `86013` files take `86013 / 512 ≈ 168` pulls. The absolute overhead of `411.4ms` results in `411.4ms / 168 = 2.45ms` per pull.
