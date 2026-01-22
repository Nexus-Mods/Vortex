let
  importJSON = file: builtins.fromJSON (builtins.readFile file);
  lock = importJSON ./flake.lock;
  node = lock.nodes.${lock.nodes.root.inputs.flake-compat};
  flake-compat = fetchTarball {
    url =
      node.locked.url or (
        with node.locked;
        "https://github.com/${owner}/${repo}/archive/${rev}.tar.gz"
      );
    sha256 = node.locked.narHash;
  };
in
import flake-compat { src = ./.; }
