class Whoop < Formula
  desc "Simple WHOOP CLI for auth and daily stats"
  homepage "https://github.com/muinmomin/whoop-cli"
  version "0.1.3"

  on_macos do
    depends_on arch: :arm64
    url "https://github.com/muinmomin/whoop-cli/releases/download/v#{version}/whoop-darwin-arm64.tar.gz"
    sha256 "9ceb194c058cc31ccf1bc0a208cfe4397c401b6a933f352c891b4a4a6209a884"
  end

  def install
    bin.install "whoop"
  end

  test do
    assert_match "whoop-cli", shell_output("#{bin}/whoop --help")
  end
end
