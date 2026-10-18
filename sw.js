"use strict";

const CACHE_NAME = "crochet-queen-admin-shell-v1";
const SHELL_FILES = [
  "./admin.html",
  "./manifest.webmanifest",
  "./admin-icon.svg",
  "./offline.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key =>
          key.startsWith("crochet-queen-admin-shell-") &&
          key !== CACHE_NAME
        ).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept Supabase, third-party scripts, or cross-origin resources.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(request, copy)
          ).catch(() => {});
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const adminPage = await caches.match("./admin.html");
        if (adminPage && url.pathname.endsWith("/admin.html")) {
          return adminPage;
        }

        return (await caches.match("./offline.html")) ||
          new Response("Offline. Reconnect to continue.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      })
    );
    return;
  }

  // Only serve the named app-shell files from cache when the network is down.
  const path = url.pathname.split("/").pop();
  const allowed = [
    "admin.html",
    "manifest.webmanifest",
    "admin-icon.svg",
    "offline.html"
  ];
  if (!allowed.includes(path)) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache =>
          cache.put(request, copy)
        ).catch(() => {});
      }
      return response;
    }).catch(async () => {
      return (await caches.match(request)) ||
        new Response("Resource unavailable offline.", { status: 503 });
    })
  );
});