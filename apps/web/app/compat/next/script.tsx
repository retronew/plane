/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useEffectEvent } from "react";

type ScriptProps = {
  src?: string;
  id?: string;
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload" | "worker";
  onLoad?: () => void;
  onError?: () => void;
  children?: string;
  defer?: boolean;
  [key: string]: any;
};

// Minimal shim for next/script that creates a script tag
function Script({ src, id, strategy: _strategy, onLoad, onError, children, ...rest }: ScriptProps) {
  const handleLoad = useEffectEvent(() => onLoad?.());
  const handleError = useEffectEvent(() => onError?.());

  useEffect(() => {
    if (src) {
      const script = document.createElement("script");
      if (id) script.id = id;
      script.src = src;
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);
      Object.keys(rest).forEach((key) => {
        script.setAttribute(key, rest[key]);
      });
      document.body.appendChild(script);

      return () => {
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      };
    } else if (children) {
      const script = document.createElement("script");
      if (id) script.id = id;
      script.textContent = children;
      Object.keys(rest).forEach((key) => {
        script.setAttribute(key, rest[key]);
      });
      document.body.appendChild(script);

      return () => {
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      };
    }
  }, [src, id, children, rest]);

  return null;
}

export default Script;
