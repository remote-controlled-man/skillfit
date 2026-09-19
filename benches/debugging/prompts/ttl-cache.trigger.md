# Task: diagnose and fix the TTL cache

The repository in your current working directory contains `src/ttl-cache.mjs`. Users report three intermittent problems:

- cached values such as `false`, `0`, and an empty string sometimes look missing;
- a value can still be returned exactly at its expiry boundary;
- repeated reads unexpectedly keep an entry alive even though this cache promises fixed, non-sliding TTL.

Find the shared causes, fix them without changing the public class API, and preserve lazy deletion of expired entries. TTL must be a finite non-negative number; invalid TTL values must throw `TypeError`.

Run the visible tests with `node --test test/*.test.mjs`.
