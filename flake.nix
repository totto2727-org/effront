{
  description = "Effront Node.js and pnpm development and npm publication environment";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1";
    vite-plus-overlay = {
      url = "github:ryoppippi/nix-vite-plus";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, vite-plus-overlay, ... }:
    let
      supportedSystems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forEachSystem = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forEachSystem (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [ vite-plus-overlay.overlays.default ];
          };
          manifest = builtins.fromJSON (builtins.readFile ./package.json);
        in
        {
          default =
            assert manifest.packageManager == "pnpm@${pkgs.pnpm.version}";
            pkgs.mkShell {
              packages = [
                pkgs.nodejs_24
                pkgs.pnpm
                pkgs.vite-plus
                pkgs.nixfmt
              ];
            };
        }
      );
    };
}
