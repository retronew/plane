/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Component } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_PORTAL_ID } from "./constants";

export type PortalWrapperProps = {
  children: ReactNode;
  className?: string;
  portalId?: string;
  fallbackToDocument?: boolean;
  onMount?: () => void;
  onUnmount?: () => void;
};

type ContainerOwnership = {
  users: number;
  observer?: MutationObserver;
};

// A DOM attribute is not proof of ownership: existing application containers
// must survive even when they happen to use the same data-portal marker.
const ownedContainers = new WeakMap<HTMLElement, ContainerOwnership>();

function acquireContainer(portalId: string) {
  let container = document.getElementById(portalId);
  if (!container) {
    container = document.createElement("div");
    container.id = portalId;
    container.setAttribute("data-portal", "true");
    document.body.appendChild(container);
    ownedContainers.set(container, { users: 0 });
  }
  const ownership = ownedContainers.get(container);
  if (ownership) {
    ownership.observer?.disconnect();
    ownership.observer = undefined;
    ownership.users += 1;
  }
  return container;
}

function releaseContainer(container: HTMLElement) {
  const ownership = ownedContainers.get(container);
  if (!ownership) return;
  ownership.users -= 1;
  if (ownership.users !== 0) return;

  // Layout cleanup precedes React's removal of portal children. Wait until the
  // commit ends, and recheck users in case StrictMode or another portal reused it.
  queueMicrotask(() => {
    if (ownership.users !== 0) return;
    const removeIfEmpty = () => {
      if (ownership.users !== 0 || container.hasChildNodes()) return;
      ownership.observer?.disconnect();
      ownership.observer = undefined;
      container.remove();
      ownedContainers.delete(container);
    };
    removeIfEmpty();
    if (container.hasChildNodes() && !ownership.observer) {
      // Foreign children retain the container until they leave. Observe only
      // this idle container; acquiring it again disconnects this observer.
      ownership.observer = new MutationObserver(removeIfEmpty);
      ownership.observer.observe(container, { childList: true });
    }
  });
}

type PortalState = { container: HTMLElement | null };

// This adapter owns an imperative DOM resource in the layout commit phase.
// Keeping its initial render empty preserves SSR/hydration, while didMount's
// synchronous update makes portal children available before the browser paints.
class PortalLifecycle extends Component<PortalWrapperProps, PortalState> {
  override state: PortalState = { container: null };
  private container: HTMLElement | null = null;

  override componentDidMount() {
    this.mountContainer();
  }

  override componentDidUpdate(previous: PortalWrapperProps) {
    if (
      previous.portalId !== this.props.portalId ||
      previous.onMount !== this.props.onMount ||
      previous.onUnmount !== this.props.onUnmount
    ) {
      this.unmountContainer(previous.onUnmount);
      this.mountContainer();
    }
  }

  override componentWillUnmount() {
    this.unmountContainer(this.props.onUnmount);
  }

  private mountContainer() {
    const container = acquireContainer(this.props.portalId ?? DEFAULT_PORTAL_ID);
    this.container = container;
    if (this.state.container !== container) this.setState({ container });
    this.props.onMount?.();
  }

  private unmountContainer(onUnmount: PortalWrapperProps["onUnmount"]) {
    const container = this.container;
    this.container = null;
    try {
      onUnmount?.();
    } finally {
      if (container) releaseContainer(container);
    }
  }

  override render() {
    if (!this.state.container) return null;
    const { children, className } = this.props;
    const content = children ? className ? <div className={className}>{children}</div> : children : null;
    return createPortal(content, this.state.container);
  }
}

/** Renders into a shared container acquired during the layout commit, with an empty SSR render. */
export function PortalWrapper(props: PortalWrapperProps) {
  return <PortalLifecycle {...props} />;
}
