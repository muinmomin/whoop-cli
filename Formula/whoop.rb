class Whoop < Formula
  desc "Simple WHOOP CLI for auth and daily stats"
  homepage "https://github.com/muinmomin/whoop-cli"
  version "0.1.2"

  on_macos do
    depends_on arch: :arm64
    url "https://github.com/muinmomin/whoop-cli/releases/download/v#{version}/whoop-darwin-arm64.tar.gz"
    sha256 "1725efbd1812822799ed8a257d075319dbc29d109f05243ed9f403bd6bd362ef"
  end

  def install
    bin.install "whoop"
  end

  test do
    assert_match "whoop-cli", shell_output("#{bin}/whoop --help")
  end
end
