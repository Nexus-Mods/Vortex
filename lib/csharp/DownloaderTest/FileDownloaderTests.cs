using NSubstitute;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using Util;
using Util.WebInterface;
using Xunit;

namespace Downloader.Tests
{
	public class FileDownloaderTests : IDisposable
	{
		IFileSystem m_mckFileSystem = null;
		IWebRequestFactory m_mckRequest = null;
		IFileWriterFactory m_mckWriterFactory = null;
		IFileWriter m_mckWriter = null;
		AutoResetEvent m_areEvent = null;

		static Uri validUrl = new Uri("http://validurl.com/file.txt");

		public FileDownloaderTests()
		{
			m_mckFileSystem = Substitute.For<IFileSystem>();
			m_mckRequest = Substitute.For<IWebRequestFactory>();
			m_mckWriterFactory = Substitute.For<IFileWriterFactory>();

			m_mckWriterFactory.Create(Arg.Any<string>(), Arg.Any<string>()).ReturnsForAnyArgs(x => {
				m_mckWriter = Substitute.For<IFileWriter>();
				m_mckWriter.WrittenByteCount.Returns((ulong)0);
				return m_mckWriter;
			 });

			m_areEvent = new AutoResetEvent(false);
		}

		/// <summary>
		/// Initializes the mock for the web-request interface
		/// </summary>
		/// <param name="content">content of the file to "host" at the valid url</param>
		void InitWebMocks(string content)
		{
			WebHeaderCollection headers = new WebHeaderCollection();
			headers.Add(HttpRequestHeader.ContentLength, content.Length.ToString());

			Stream contentStream = new MemoryStream(Encoding.UTF8.GetBytes(content));

			IHttpWebResponse mockResponse = Substitute.For<IHttpWebResponse>();
			IHttpWebRequest mockRequest = Substitute.For<IHttpWebRequest>();

			mockResponse.StatusCode.Returns(HttpStatusCode.OK);
			mockResponse.Headers.Returns(headers);
			mockResponse.GetResponseHeader("Content-length").Returns(content.Length.ToString());
			mockResponse.GetResponseStream().Returns(contentStream);
			mockRequest.GetResponse().Returns(mockResponse);
			mockRequest.Headers.Returns(new WebHeaderCollection());

			m_mckRequest.Create(Arg.Is<Uri>(x => x != validUrl)).Returns(x => { throw new ArgumentException(); });
			m_mckRequest.Create(validUrl).Returns(mockRequest);
		}

		[Fact]
		public void CanInitializeValidTest()
		{
			InitWebMocks("content doesn't matter");
			Dictionary<string, string> cookies = new Dictionary<string, string>();
			string output = "c:/temp/";
			new FileDownloader(m_mckFileSystem, m_mckRequest, m_mckWriterFactory, validUrl, cookies, output, true, 1, 1, "user-agent");
		}

		[Fact]
		public void InitializeFailsWithInvalidUriTest()
		{
			// TODO this is a bit pointless as this mostly tests the mock
			InitWebMocks("content doesn't matter");
			Uri fileUrl = new Uri("file://c/temp/test.txt");
			Uri fakeUrl = new Uri("fake://c/temp/test.txt");
			Dictionary<string, string> cookies = new Dictionary<string, string>();
			string output = "c:/temp/";
			Assert.Throws<ArgumentException>(() =>
				new FileDownloader(m_mckFileSystem, m_mckRequest, m_mckWriterFactory, fileUrl, cookies, output, true, 1, 100, "user-agent"));
			Assert.Throws<ArgumentException>(() =>
				new FileDownloader(m_mckFileSystem, m_mckRequest, m_mckWriterFactory, fakeUrl, cookies, output, true, 1, 100, "user-agent"));
		}

		FileDownloader doDownload()
		{
			Dictionary<string, string> cookies = new Dictionary<string, string>();
			string output = "c:/temp/";
			FileDownloader downloader = new FileDownloader(m_mckFileSystem, m_mckRequest, m_mckWriterFactory, validUrl,
				cookies, output, true, 1, 100, "user-agent");
			downloader.DownloadComplete += new EventHandler<CompletedDownloadEventArgs>(
				(obj, CompletedDownloadEventArgs) => { m_areEvent.Set(); });
			downloader.StartDownload();
			return downloader;
		}

		[Fact]
		public void SuccessfulDownloadTest()
		{
			// TODO this is a bit to complex
			string content = "file content";
			InitWebMocks(content);

			doDownload();
			m_mckFileSystem.Exists("").ReturnsForAnyArgs(true);
			m_mckWriter.WrittenByteCount.Returns((ulong)content.Length);
			m_areEvent.WaitOne();

			byte[] contentBytes = System.Text.Encoding.UTF8.GetBytes(content);

			// assert the exact bytes our mock server produces are written
			m_mckWriter.Received().EnqueueBlock((ulong)0, Arg.Is<byte[]>(x => x.SequenceEqual(contentBytes)));
			// assert nothing else was written
			m_mckWriter.DidNotReceive().EnqueueBlock(1, Arg.Any<byte[]>());
			// assert the file gets closed/flushed
			m_mckWriter.Received().Close();
			// assert temporary files got cleaned up
			m_mckFileSystem.Received().ForceDelete("c:/temp/file.txt.parts");
			m_mckFileSystem.Received().ForceDelete("c:/temp/file.txt");
			m_mckFileSystem.Received().Move("c:/temp/file.txt.partial", "c:/temp/file.txt");
		}

		[Fact]
		public void StopTest()
		{
			string content = "file content";
			InitWebMocks(content);

			CompletedDownloadEventArgs completedReceived = null;

			FileDownloader downloader = doDownload();
			downloader.DownloadComplete += new EventHandler<CompletedDownloadEventArgs>(
				(object sender, CompletedDownloadEventArgs args) => { completedReceived = args; });

			m_mckWriter.WrittenByteCount.Returns((ulong)5);
			downloader.Stop();
			// assert downloadcomplete event got called
			Assert.NotNull(completedReceived);
		}

		[Fact]
		public void CleanupTest()
		{
			string content = "file content";
			InitWebMocks(content);

			FileDownloader downloader = doDownload();
			m_areEvent.WaitOne();

			m_mckFileSystem.Exists("").ReturnsForAnyArgs(true);

			downloader.Cleanup();

			m_mckFileSystem.Received().ForceDelete("c:/temp/file.txt.parts");
			m_mckFileSystem.Received().ForceDelete("c:/temp/file.txt.partial");
		}

		#region IDisposable Support

		private bool m_booDisposedValue = false;

		protected virtual void Dispose(bool disposing)
		{
			if (!m_booDisposedValue)
			{
				if (disposing)
				{
					m_areEvent.Dispose();
				}

				m_booDisposedValue = true;
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}
		#endregion
	}
}