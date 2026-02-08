class Whoop < Formula
  desc "Simple WHOOP CLI for auth and daily stats"
  homepage "https://github.com/muinmomin/whoop-cli"
  version "0.1.1"

  on_macos do
    depends_on arch: :arm64
    url "https://github.com/muinmomin/whoop-cli/releases/download/v#{version}/whoop-darwin-arm64.tar.gz"
    sha256 "bcf4af61295b086bda3301c6b85ee85553e7c24208b574af804ebb539d7bafdd"
  end

  def install
    bin.install "whoop"
  end

  test do
    assert_match "whoop-cli", shell_output("#{bin}/whoop --help")
  end
end
