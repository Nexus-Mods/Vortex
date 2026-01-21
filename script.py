#!/usr/bin/env python

import pandas as pd
import networkx as nx

def project_connections_subgraph(G: nx.DiGraph, source_project: str, target_project: str, return_paths=False):
    """
    Find all connections from nodes in source_project to nodes in target_project.

    Parameters:
        G : networkx.Graph
            The input graph.
        source_project : str
            Project label for source nodes.
        target_project : str
            Project label for target nodes.
        return_paths : bool
            If True, also returns all simple paths (can be memory intensive).

    Returns:
        H : networkx.Graph
            Subgraph containing all relevant nodes and edges.
        all_paths : list of lists (optional)
            List of all simple paths if return_paths=True.
    """
    # Identify source and target nodes
    source_nodes = [n for n, d in G.nodes(data=True) if d.get("project") == source_project]
    target_nodes = [n for n, d in G.nodes(data=True) if d.get("project") == target_project]

    nodes_in_paths = set()
    edges_in_paths = set()
    all_paths = []

    for source in source_nodes:
        # Compute reachable nodes and paths
        if return_paths:
            # Find all simple paths from this source to all target nodes
            for target in target_nodes:
                try:
                    paths = list(nx.all_simple_paths(G, source=source, target=target))
                    all_paths.extend(paths)
                    for path in paths:
                        nodes_in_paths.update(path)
                        edges_in_paths.update((path[i], path[i+1]) for i in range(len(path)-1))
                except nx.NetworkXNoPath:
                    continue
        else:
            # Only track reachable target nodes (more efficient)
            reachable = nx.single_source_shortest_path_length(G, source)
            for target in target_nodes:
                if target in reachable:
                    # Include the shortest path edges
                    path = nx.shortest_path(G, source, target)
                    nodes_in_paths.update(path)
                    edges_in_paths.update((path[i], path[i+1]) for i in range(len(path)-1))

    # Build subgraph
    H = G.subgraph(nodes_in_paths).copy()

    if return_paths:
        return H, all_paths
    else:
        return H

nodes_df = pd.read_csv("nodes.csv", dtype={"id": str})
edges_df = pd.read_csv("edges.csv", dtype={"source": str, "target": str})

G = nx.DiGraph()

for _, row in nodes_df.iterrows():
    G.add_node(row["id"], label=row["label"], project=row["project"])

for _, row in edges_df.iterrows():
    G.add_edge(row["source"], row["target"])

nx.write_gexf(G, "graph.gexf")

H, paths = project_connections_subgraph(G, "main", "renderer", return_paths=True)
nx.write_gexf(H, "main-to-renderer.gexf")

for p in paths:
    print(p)


