process.on("message", () => process.send({ type: "rpc", id: 1, method: "eval", params: [] }));
