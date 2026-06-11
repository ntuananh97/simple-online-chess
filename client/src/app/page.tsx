import { ApiError, healthApi } from "@/lib/api";

export default async function Home() {
  let health = null;
  let error: string | null = null;

  try {
    health = await healthApi.getHealth();
  } catch (err) {
    error =
      err instanceof ApiError
        ? `${err.message} (${err.status})`
        : "Không thể kết nối tới API";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-lg flex-col gap-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Simple Online Chess
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Chơi cờ trực tuyến — không cần đăng ký.
          </p>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            API mẫu — GET /
          </h2>

          {health ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">message</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {health.message}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">database</dt>
                <dd
                  className={
                    health.database === "connected"
                      ? "font-medium text-emerald-600"
                      : "font-medium text-amber-600"
                  }
                >
                  {health.database}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
