{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.nodePackages.typescript-language-server
  ];

  env = {
    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [];
  };
}
