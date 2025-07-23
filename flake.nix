{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };
  nixConfig = {
      bashPromptSuffix = "nix";
  };
  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems =
        function:
        nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (
          system: function nixpkgs.legacyPackages.${system}
        );
    in
    {
      formatter = forAllSystems (pkgs: pkgs.alejandra);
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            deno
            nodejs_24
            bun
            flyctl
            lefthook
          ];

        shellHook = ''
          # I find this immensely lame but I didn't find a better solution
          # this is all for the sqlite JS lib to find libstdc++.so.
          # changing LD_LIBRARY_PATH in the global env breaks things (ex: kitty).
          mkdir -p .bin
          echo '#!/bin/sh' > .bin/bun
          echo 'LD_LIBRARY_PATH=${pkgs.stdenv.cc.cc.lib}/lib exec ${pkgs.bun}/bin/bun "$@"' >> .bin/bun
          chmod +x .bin/bun
          export PATH="$(pwd)/.bin:$PATH"
        '';
        };
      });
    };
}
