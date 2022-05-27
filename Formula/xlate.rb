require "language/node"

class Xlate < Formula
  desc "Translate your XCode project into multiple target languages with one command!"
  homepage "https://xlate.dev/"
  url "https://registry.npmjs.org/xlate/-/xlate-0.1.2.tgz"
  sha256 "602e7443f7c15ab57a1c01cbc575ee286ff4fae73ab7e831724aa0c13d6c0726"
  license "MIT"

  livecheck do
    url :stable
  end

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/xlate --version")
  end
end
