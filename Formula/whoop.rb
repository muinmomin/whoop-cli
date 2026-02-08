class Whoop < Formula
  desc "Simple WHOOP CLI for auth and daily stats"
  homepage "https://github.com/muinmomin/whoop-cli"
  version "0.1.0"

  on_macos do
    depends_on arch: :arm64
    url "https://github.com/muinmomin/whoop-cli/releases/download/v#{version}/whoop-darwin-arm64.tar.gz"
    sha256 "5d36687962cfad6dd8d0d28e7672a9879a7c8fab0563da9904fc899a791eb946"
  end

  def install
    bin.install "whoop"
  end

  test do
    assert_match "whoop-cli", shell_output("#{bin}/whoop --help")
  end
end
