using NSubstitute;
using Xunit;

namespace Mods.Tests
{
	public class FilenameModComparerTests
	{
		[Fact]
		public void CompareTest()
		{
			FilenameModComparer comparer = new FilenameModComparer();
			IMod shortLow = Substitute.For<IMod>();
			shortLow.Filename.Returns("a");
			IMod shortHigh = Substitute.For<IMod>();
			shortHigh.Filename.Returns("z");
			IMod lcLow = Substitute.For<IMod>();
			lcLow.Filename.Returns("aaa");
			IMod lcHigh = Substitute.For<IMod>();
			lcHigh.Filename.Returns("yyy");
			IMod ucHigh = Substitute.For<IMod>();
			ucHigh.Filename.Returns("YYY");
			IMod numHigh = Substitute.For<IMod>();
			numHigh.Filename.Returns("9999");
			IMod special = Substitute.For<IMod>();
			special.Filename.Returns("___");
			IMod umlaut = Substitute.For<IMod>();
			umlaut.Filename.Returns("äää");
			IMod japanese = Substitute.For<IMod>();
			japanese.Filename.Returns("こんにちは");


			Assert.True(comparer.Compare(lcLow, lcHigh) < 0, "simple order");
			Assert.True(comparer.Compare(lcHigh, lcLow) > 0, "simple order reverse");
			Assert.True(comparer.Compare(lcLow, lcLow) == 0, "equality");

			Assert.True(comparer.Compare(shortLow, lcLow) < 0, "sort alphabetically before length");
			Assert.True(comparer.Compare(lcLow, shortHigh) < 0, "sort alphabetically before length");

			Assert.True(comparer.Compare(ucHigh, lcHigh) == 0, "case insensitive comparison");

			Assert.True(comparer.Compare(numHigh, lcLow) < 0, "number before characters");
			Assert.True(comparer.Compare(lcLow, special) < 0, "special characters after characters");

			Assert.True(comparer.Compare(lcHigh, umlaut) < 0, "foreign characters after latin");
			Assert.True(comparer.Compare(lcHigh, japanese) < 0, "foreign characters after latin");
		}
	}
}