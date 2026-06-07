import { task } from "@trigger.dev/sdk/v3";

export const myFirstTask = task({
  id: "hello-world", // 每个任务需要唯一的 ID
  run: async (payload: { message: string }) => {
    console.log("任务已执行！", payload.message);
    return { success: true };
  },
});