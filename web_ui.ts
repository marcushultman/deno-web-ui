import { VNode } from 'preact';
import renderComp from 'preact-render-to-string';
import { open } from 'opener';

export type Render<T> = (state: T) => VNode<unknown>;
export type OnPost<T> = (
  args: { state: T; req: Request },
) => Promise<T | undefined | void> | T | undefined | void;

export interface Props<T> {
  head: string;
  state: T;
  render: Render<T>;
  onPost: OnPost<T>;
  noOpen: boolean;
  port: number;
}

type InnerProper<T> = Partial<Omit<Props<T>, 'state'>> & Pick<Props<T>, 'state'>;

const htmlPageWithBody = (body: VNode<unknown>, head = '') =>
  `<!DOCTYPE html>
<html lang="en" hidden>
  <meta charset="UTF-8">
  <head>
    ${head}
    <script>fetch('/__dev').catch(() => location.reload())</script>
  </head>
  <body>
    ${renderComp(body)}
  </body>
</html>
`;

export default async function <T>(props: Partial<Props<T>> | Render<T>) {
  let { head, state, render, onPost, noOpen, port = 9001 } =
    (typeof props === 'function' ? { render: props } : props) as InnerProper<T>;

  const server = Deno.serve({ port }, async (req) => {
    if (new URL(req.url).pathname === '/__dev') {
      return new Promise(() => {});
    }
    try {
      if (req.method === 'POST') {
        state = { ...state, ...await onPost?.({ state, req }) };
      }
    } catch (_: unknown) {
      return Response.error();
    }

    if (!render) {
      return new Response(JSON.stringify(state), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(htmlPageWithBody(render(state), head), {
      headers: { 'content-type': 'text/html' },
    });
  });

  if (!noOpen) {
    await open(`http://localhost:${port}`);
  }

  await server.finished;
}
