using System;
using System.IO;
using System.Net;

namespace Util.WebInterface
{
	public interface IHttpWebResponse : IDisposable
	{
		WebHeaderCollection Headers { get; }
		HttpStatusCode StatusCode { get; }

		Stream GetResponseStream();
		string GetResponseHeader(string headerName);
	}

	public interface IHttpWebRequest
	{
		//string Response { get; set; }
		WebHeaderCollection Headers { get; }

		CookieContainer CookieContainer { get; set;  }
		string Method { get; set; }
		bool AllowAutoRedirect { get; set; }
		string UserAgent { get; set;  }
		void AddRange(int from, int to);

		IHttpWebResponse GetResponse();
	}

	public interface IWebRequestFactory
	{
		IHttpWebRequest Create(Uri uri);
		//object Create(List<Uri> list);
	}
}
