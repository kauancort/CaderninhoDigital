import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/a-receber")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/vendas/a-receber${location.searchStr}`,
      replace: true,
    });
  },
});
