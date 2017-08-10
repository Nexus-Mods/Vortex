using Xunit;
using Xunit.Abstractions;
using System.Threading.Tasks;

namespace FomodInstaller.ModInstaller.Tests
{
	public class InstallerProxyTests
	{
		private readonly ITestOutputHelper output;
		public InstallerProxyTests(ITestOutputHelper output)
		{
			this.output = output;
		}

		[Theory()]
		// input missing
		public async Task Install(dynamic input)
		{
			InstallerProxy installer = new InstallerProxy();
			var actual = await installer.Install(input);

			// Xunit test
			Assert.Null(actual);
			Assert.NotNull(actual);
			output.WriteLine("This is output from {0}", actual);
		}

		[Theory()]
		// input missing
		public async Task TestSupported(dynamic input)
		{
			InstallerProxy installer = new InstallerProxy();
			var actual = await installer.TestSupported(input);

			// Xunit test
			Assert.Null(actual);
			Assert.NotNull(actual);
			output.WriteLine("This is output from {0}", actual);
		}
	}
}