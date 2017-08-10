using Xunit;
using Xunit.Abstractions;
using System.Threading.Tasks;

namespace FomodInstaller.ModInstaller.Tests
{
	public class ModFormatManagerTests
	{

		private readonly ITestOutputHelper output;

		public ModFormatManagerTests(ITestOutputHelper output)
		{
			this.output = output;
		}

		[Theory]
		[InlineData(0, new object[] { "test.esm", "test.esp" })]
		[InlineData(0, new object[] { })]
		public async Task GetRequirements(int dummy, string[] modFiles)
		{
			 
		Assert.Empty(modFiles);

		ModFormatManager installer = new ModFormatManager();
			var actual = await installer.GetRequirements(modFiles, false);

			// Xunit test
			// Assert.Null(actual);
			Assert.NotNull(actual);
			output.WriteLine("This is output from {0}", actual);
		}
	}
}