# ModMeta DB

This is a library and server to provide extended information about game modifications (mods).
The goal is to allow webpages or communities to provide additional information about mods, both for users
and for management applications, without requireing mod authors to provide them (although we do encourage
communities to respect the wishes of mod authors)

## Concepts

Mods are identified by the file hash of the published archive. The file size and an id of the game can be
supplied as well to avoid collisions.

Most mod pages like Nexus Mods allow multiple, related, files to be treated as one mod, i.e. one texture mod
could exist in different resolution variants.
In this mod database, these variants would be treated as separate, independent mods, only different versions
of the same file are treated as "related", i.e. "some texture mod 2k v1.0.0" and "some texture mod 2k v1.1.0"
would be considered the same mod but "some texture mod 2k v1.0.0" and "some texture mod 4k v1.0.0" would not.

While this database uses its own rest-api for lookup, the library also contains an adapter so it can connect
directly to the Nexus Mods website api.

## Library

When integrated as a library into an application, this project will usually be set up with one or multiple
back-end servers.
Queries for meta information are sequentially passed through to these servers until one provides a result.
The library creates a local database that acts as a cache, storing locally the results of queries to reduce
network load.

## Server

As mentioned, this tool can be run as a http rest server. In this mode it runs as a stand-alone application
that provides its local cache (which is still filled by querying back-end servers if that is configured)
through a rest api.
This should be considered a sample implementation. It's probably not well suited for a server that expects
a lot of traffic.
