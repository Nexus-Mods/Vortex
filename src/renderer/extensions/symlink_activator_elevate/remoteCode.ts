import { getErrorCode } from "@vortex/shared";

export function remoteCode(ipcClient, req) {
  const RETRY_ERRORS = new Set(["EPERM", "EBUSY", "EIO", "EBADF", "UNKNOWN"]);
  process.noAsar = true;

  const delayed = (delay: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, delay);
    });

  const doFS = (op: () => Promise<any>, tries: number = 5) => {
    return op().catch((err) => {
      const code = getErrorCode(err);
      if (RETRY_ERRORS.has(code) && tries > 0) {
        return delayed(100).then(() => doFS(op, tries - 1));
      } else {
        return Promise.reject(err);
      }
    });
  };

  return new Promise<void>((resolve, reject) => {
    const fs = req("fs").promises;

    const emit = (message, payload) => {
      ipcClient.sendMessage({ message, payload });
    };

    const handlers = {
      "link-file": (payload) => {
        const { source, destination, num } = payload;
        return doFS(() => fs.symlink(source, destination))
          .catch((err) =>
            err.code !== "EEXIST"
              ? Promise.reject(err)
              : doFS(() => fs.unlink(destination)).then(() =>
                  doFS(() => fs.symlink(source, destination)),
                ),
          )
          .then(() => {
            emit("log", {
              level: "debug",
              message: "installed",
              meta: { source, destination },
            });
            emit("completed", { err: null, num });
          })
          .catch((err) => {
            if (err.code === "EISDIR") {
              emit("report", "not-supported");
            }
            emit("completed", {
              err: {
                // in case message is a getter
                message: err.message,
                ...err,
              },
              num,
            });
          });
      },
      "remove-link": (payload) => {
        const { destination, num } = payload;
        doFS(() => fs.lstat(destination))
          .then((stats) => {
            if (stats.isSymbolicLink()) {
              return doFS(() => fs.unlink(destination));
            }
          })
          .then(() => {
            emit("completed", { err: null, num });
          })
          .catch((err) => {
            emit("completed", {
              err: { code: err.code, message: err.message, stack: err.stack },
              num,
            });
          });
      },
      quit: () => {
        // currently don't need this message, the server closes the connection and
        // we clean up when the ipc is disconnected
        resolve();
        resolve = undefined;
      },
    };

    ipcClient.on("message", (data) => {
      const { message, payload } = data;
      if (handlers[message] !== undefined) {
        handlers[message](payload);
      } else {
        emit("log", {
          level: "error",
          message: `unknown message "${message}", expected one of "${Object.keys(handlers).join(", ")}"`,
          meta: { got: message },
        });
      }
    });

    ipcClient.on("disconnect", () => {
      if (resolve !== undefined) {
        resolve();
      }
    });
    emit("initialised", {
      pid: process.pid,
    });
  });
}
