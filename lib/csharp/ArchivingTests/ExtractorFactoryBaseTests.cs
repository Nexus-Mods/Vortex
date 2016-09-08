using NSubstitute;
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using Xunit;

namespace Archiving.Tests
{
	public static class Reflect
	{
		public static object Protected(this object target, string name, params object[] args)
		{
			Type type = target.GetType();
			MethodInfo method = type.GetMethods(BindingFlags.NonPublic | BindingFlags.Instance)
							 .Where((MethodInfo x) => {
								 return x.Name == name;
								 }).Single();
			return method.Invoke(target, args);
		}


		public static object Protected(this object target, string name, Type[] argTypes, params object[] args)
		{
			Type type = target.GetType();

			MethodInfo method = type.GetMethod(name, BindingFlags.NonPublic | BindingFlags.Instance, null, argTypes, null);
			return method.Invoke(target, args);
		}
	}


	public class ExtractorFactoryBaseTests
	{
		const string ARCHIVE_NAME = @"c:\archive.zip";

		ExtractorFactoryBase factory;

		public ExtractorFactoryBaseTests()
		{
			factory = Substitute.ForPartsOf<ExtractorFactoryBase>();
		}


		[Fact]
		public void GetCompressorTest()
		{
			factory.GetCompressor();

			factory.Received().Protected("CreateCompressor");
		}

		[Fact]
		public void GetExtractorTestSimple()
		{
			factory.GetExtractor(ARCHIVE_NAME);

			factory.Received().Protected("CreateExtractor", new Type[] { typeof(string), typeof(bool) },
				ARCHIVE_NAME, false);
		}

		[Fact]
		public void GetExtractorTestNested()
		{
			factory.GetExtractor("arch:arch:" + ARCHIVE_NAME + "//" + ARCHIVE_NAME + "//somefile.txt");
			// should create 3 extractors, two nested
			factory.Received(2).Protected("CreateExtractor", new Type[] { typeof(Stream), typeof(bool) },
				Arg.Any<MemoryStream>(), false);
			factory.Received().Protected("CreateExtractor", new Type[] { typeof(string), typeof(bool) },
				ARCHIVE_NAME, false);
		}

		[Fact]
		public void GetThreadSafeExtractorTest()
		{
			factory.GetThreadSafeExtractor(ARCHIVE_NAME);

			factory.Received().Protected("CreateExtractor", new Type[] { typeof(string), typeof(bool) },
				ARCHIVE_NAME, true);
		}
	}
}