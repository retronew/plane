import { act, render, screen } from "@testing-library/react";
import { StrictMode, useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PortalWrapper } from "./portal-wrapper";

async function flushCleanup() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("PortalWrapper", () => {
  it("renders nothing on the server and mounts children during layout", () => {
    expect(renderToString(<PortalWrapper>Server</PortalWrapper>)).toBe("");
    const mounted = vi.fn();
    function Child() {
      useLayoutEffect(() => {
        mounted(document.getElementById("layout-portal")?.isConnected);
      }, []);
      return <span>Layout child</span>;
    }
    const view = render(
      <PortalWrapper portalId="layout-portal">
        <Child />
      </PortalWrapper>
    );
    expect(mounted).toHaveBeenCalledWith(true);
    expect(screen.getByText("Layout child")).toBeDefined();
    view.unmount();
  });

  it("hydrates the empty server render before mounting portal content", async () => {
    const element = <PortalWrapper portalId="hydrated-portal">Hydrated child</PortalWrapper>;
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(host, element, { onRecoverableError });
    });
    expect(document.getElementById("hydrated-portal")?.textContent).toBe("Hydrated child");
    expect(onRecoverableError).not.toHaveBeenCalled();
    act(() => root!.unmount());
    await flushCleanup();
    expect(document.getElementById("hydrated-portal")).toBeNull();
    host.remove();
  });

  it("removes its container after React removes portal children", async () => {
    const view = render(
      <PortalWrapper portalId="owned-portal">
        <span>Child</span>
      </PortalWrapper>
    );
    view.unmount();
    await flushCleanup();
    expect(document.getElementById("owned-portal")).toBeNull();
  });

  it("never removes an externally owned container, even if marked data-portal", async () => {
    const container = document.createElement("div");
    container.id = "external-portal";
    container.setAttribute("data-portal", "true");
    document.body.append(container);
    const view = render(<PortalWrapper portalId={container.id}>{null}</PortalWrapper>);
    view.unmount();
    await flushCleanup();
    expect(container.isConnected).toBe(true);
    container.remove();
  });

  it("shares ownership across StrictMode instances and releases the last user", async () => {
    const view = render(
      <StrictMode>
        <PortalWrapper portalId="shared-portal">
          <span>First</span>
        </PortalWrapper>
        <PortalWrapper portalId="shared-portal">
          <span>Second</span>
        </PortalWrapper>
      </StrictMode>
    );
    view.rerender(
      <StrictMode>
        <PortalWrapper portalId="shared-portal">
          <span>First</span>
        </PortalWrapper>
      </StrictMode>
    );
    await flushCleanup();
    expect(screen.getByText("First").isConnected).toBe(true);
    expect(document.querySelectorAll("#shared-portal")).toHaveLength(1);
    view.unmount();
    await flushCleanup();
    expect(document.getElementById("shared-portal")).toBeNull();
  });

  it("moves children on ID changes and retains callback lifecycle semantics", async () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    const nextMount = vi.fn();
    const view = render(
      <PortalWrapper portalId="old-portal" onMount={mount} onUnmount={unmount}>
        Child
      </PortalWrapper>
    );
    view.rerender(
      <PortalWrapper portalId="new-portal" onMount={nextMount} onUnmount={unmount}>
        Child
      </PortalWrapper>
    );
    await flushCleanup();
    expect(document.getElementById("old-portal")).toBeNull();
    expect(document.getElementById("new-portal")?.textContent).toBe("Child");
    expect(mount).toHaveBeenCalledTimes(1);
    expect(nextMount).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
    view.rerender(
      <PortalWrapper portalId="new-portal" onMount={mount} onUnmount={unmount} className="content">
        Updated
      </PortalWrapper>
    );
    expect(mount).toHaveBeenCalledTimes(2);
    expect(unmount).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Updated").className).toBe("content");
    view.unmount();
    await flushCleanup();
    expect(unmount).toHaveBeenCalledTimes(3);
  });

  it("tolerates a container being removed or reparented externally", async () => {
    const view = render(<PortalWrapper portalId="detached-portal">Child</PortalWrapper>);
    document.getElementById("detached-portal")?.remove();
    expect(() => view.unmount()).not.toThrow();
    await flushCleanup();
    const parent = document.createElement("section");
    document.body.append(parent);
    const next = render(<PortalWrapper portalId="moved-portal">Child</PortalWrapper>);
    parent.append(document.getElementById("moved-portal")!);
    next.unmount();
    await flushCleanup();
    expect(parent.childNodes).toHaveLength(0);
    parent.remove();
  });

  it("does not let pending cleanup remove a container acquired by a new instance", async () => {
    const first = render(<PortalWrapper portalId="reused-portal">First</PortalWrapper>);
    const container = document.getElementById("reused-portal");
    first.unmount();
    const second = render(<PortalWrapper portalId="reused-portal">Second</PortalWrapper>);
    await flushCleanup();
    expect(document.getElementById("reused-portal")).toBe(container);
    expect(screen.getByText("Second").isConnected).toBe(true);
    second.unmount();
    await flushCleanup();
    expect(document.getElementById("reused-portal")).toBeNull();
  });

  it("preserves foreign children and removes the owned container once they leave", async () => {
    const view = render(<PortalWrapper portalId="foreign-child-portal">Child</PortalWrapper>);
    const container = document.getElementById("foreign-child-portal")!;
    const foreign = document.createTextNode("External text");
    container.append(foreign);
    view.unmount();
    await flushCleanup();
    expect(container.isConnected).toBe(true);
    foreign.remove();
    await flushCleanup();
    expect(container.isConnected).toBe(false);
  });
});
