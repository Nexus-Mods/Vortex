using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using Util.Threading;
using Util.WebInterface;

namespace Downloader
{
	public partial class FileDownloader
	{
		/// <summary>
		/// Downloads pieces of a file until the entire file is downloaded, or instructed to stop.
		/// </summary>
		protected class BlockDownloader
		{
			public event EventHandler FinishedDownloading = delegate { };

			private FileDownloader m_fdrFileDownloader = null;
			private FileMetadata m_fmdInfo = null;
			private IFileWriter m_fwrWriter = null;
			private Int32 m_intBufferSize = 1 * 1024;
			private bool m_booKeepRunning = true;
			private UInt64 m_intDownloadedByteCount = 0;
			private string m_strUserAgent = "";
			private IWebRequestFactory m_wrfRequest = null;

			#region Properties

			/// <summary>
			/// Gets whether the downloader has finished downloading all available blocks.
			/// </summary>
			/// <remarks>
			/// Being finished does not mean that all available blocks have been downloaded; the download
			/// may have been interrupted.
			/// </remarks>
			/// <value>Whether the downloader has finished downloading all available blocks.</value>
			public bool Finished { get; private set; }

			/// <summary>
			/// Gets the number of bytes that have been downloaded.
			/// </summary>
			/// <value>The number of bytes that have been downloaded.</value>
			public UInt64 DownloadedByteCount
			{
				get
				{
					return m_intDownloadedByteCount;
				}
			}

			/// <summary>
			/// Gets the current error code, if anything wrong happened.
			/// </summary>
			/// <value>The current error code, if anything wrong happened.</value>
			public string ErrorCode { get; private set; }

			/// <summary>
			/// Gets the current error info, if anything wrong happened.
			/// </summary>
			/// <value>The current error info, if anything wrong happened.</value>
			public string ErrorInfo { get; private set; }

			#endregion

			#region Constructors

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_fdrFileDownloader">The <see cref="FileDownloader"/> from which to retrieve the block this
			/// downloader will download.</param>
			/// <param name="p_fmdInfo">The metadata of the to be downloaded.</param>
			/// <param name="p_fwrWriter">The writer to use to write the file to the disk.</param>
			/// <param name="p_intBufferSize">The size of the buffer to send to the file writer.</param>
			/// <param name="p_strUserAgent">The current User Agent.</param>
			public BlockDownloader(IWebRequestFactory p_wrfRequest, FileDownloader p_fdrFileDownloader, FileMetadata p_fmdInfo, IFileWriter p_fwrWriter, Int32 p_intBufferSize, string p_strUserAgent)
			{
				m_wrfRequest = p_wrfRequest;
				m_fdrFileDownloader = p_fdrFileDownloader;
				m_fmdInfo = p_fmdInfo;
				m_fwrWriter = p_fwrWriter;
				m_intBufferSize = p_intBufferSize;
				m_strUserAgent = p_strUserAgent;
				m_fwrWriter.UnableToWrite += new EventHandler(FileWriter_UnableToWrite);
			}

			#endregion

			/// <summary>
			/// Starts the file download.
			/// </summary>
			/// <remarks>
			/// After a block has finished downloading, a new block will be requested for download.
			/// this will continue until no blocks are left, or told to stop.
			/// </remarks>
			public void Start()
			{
				Finished = false;
				TrackedThread thdDownloader = new TrackedThread(DoStart);
				thdDownloader.Thread.Name = String.Format("Block Dldr @ {0}", DateTime.Now);
				thdDownloader.Start();
			}

			/// <summary>
			/// This method gets the next block to download, and downloads it. This loops
			/// until there are no more blocks, or we are told to stop.
			/// </summary>
			/// <remarks>
			/// This method is run on a thread.
			/// </remarks>
			private void DoStart()
			{
				Range rngBlockToDownload = null;
				try
				{
					while (m_booKeepRunning && ((rngBlockToDownload = m_fdrFileDownloader.GetNextBlock()) != null))
					{
						DownloadBlock(rngBlockToDownload);
					}
				}
				finally
				{
					Finished = true;
					FinishedDownloading(this, new EventArgs());
				}
			}

			/// <summary>
			/// Instructs the downloader to stop.
			/// </summary>
			public void Stop()
			{
				m_booKeepRunning = false;
				m_fwrWriter.Close();
			}

			/// <summary>
			/// Handles the <see cref="FileWriter.UnableToWrite"/> events of the
			/// <see cref="FileWriter"/>s being used.
			/// </summary>
			/// <remarks>
			/// This stops the file download once all the <see cref="FileWriter"/>s have
			/// finished.
			/// </remarks>
			/// <param name="sender">The object that raised the event.</param>
			/// <param name="e">An <see cref="EventArgs"/> desciribing the event arguments.</param>
			private void FileWriter_UnableToWrite(object sender, EventArgs e)
			{
				ErrorCode = "666";
				ErrorInfo = "Unable to write, the file is being used by another process.";
				Stop();
				FinishedDownloading(this, new EventArgs());
			}

			/// <summary>
			/// Downloads the specified block.
			/// </summary>
			/// <param name="p_rngBlockToDownload">The range of the file to download.</param>
			private void DownloadBlock(Range p_rngBlockToDownload)
			{
				bool booRetry = true;
				Int32 intLineTracker = 0;
				try
				{
					for (Int32 i = 0; i < 5 && booRetry; i++)
					{
						booRetry = false;
						MethodInfo method = typeof(WebHeaderCollection).GetMethod
						("AddWithoutValidate", BindingFlags.Instance | BindingFlags.NonPublic);

						IHttpWebRequest hwrDownload = m_wrfRequest.Create(m_fdrFileDownloader.URL);
						intLineTracker = 1;
						CookieContainer ckcCookies = new CookieContainer();
						foreach (KeyValuePair<string, string> kvpCookie in m_fdrFileDownloader.Cookies)
							ckcCookies.Add(new Cookie(kvpCookie.Key, kvpCookie.Value, "/", m_fdrFileDownloader.URL.Host));
						intLineTracker = 2;
						hwrDownload.CookieContainer = ckcCookies;
						hwrDownload.Method = "GET";
						hwrDownload.UserAgent = m_strUserAgent;
						hwrDownload.AllowAutoRedirect = true;
						intLineTracker = 3;
						string strK = "Range";
						string strVal = string.Format("bytes={0}-{1}", p_rngBlockToDownload.StartByte, p_rngBlockToDownload.EndByte);
						method.Invoke(hwrDownload.Headers, new object[] { strK, strVal });
						intLineTracker = 4;
						if (!String.IsNullOrEmpty(m_fmdInfo.ETag))
							hwrDownload.Headers.Add("If-Match", m_fmdInfo.ETag);
						intLineTracker = 5;

						try
						{
							using (IHttpWebResponse wrpDownload = hwrDownload.GetResponse())
							{
								intLineTracker = 6;
								if ((wrpDownload.StatusCode != HttpStatusCode.PartialContent) && (wrpDownload.StatusCode != HttpStatusCode.OK))
									return;
								intLineTracker = 7;

								//make sure we have the right file
								string strETag = wrpDownload.GetResponseHeader("ETag");
								if (!String.Equals(m_fmdInfo.ETag ?? "", strETag ?? ""))
									return;
								intLineTracker = 8;

								//make sure we have the right range
								UInt64 intTotalFileLength = 0;
								Range rngRetrievedRange = null;
								if (wrpDownload.StatusCode == HttpStatusCode.PartialContent)
								{
									intLineTracker = 9;
									string strRangeValue = wrpDownload.GetResponseHeader("Content-Range");
									if (String.IsNullOrEmpty(strRangeValue))
										return;
									intLineTracker = 10;
									string[] strRange = strRangeValue.Split(' ', '-', '/');
									intLineTracker = 11;
									if (!strRange[0].Equals("bytes"))
										return;
									intLineTracker = 12;
									rngRetrievedRange = new Range(UInt64.Parse(strRange[1]), UInt64.Parse(strRange[2]));
									intTotalFileLength = UInt64.Parse(strRange[3]);
									intLineTracker = 13;
								}
								else if (wrpDownload.StatusCode == HttpStatusCode.OK)
								{
									intLineTracker = 14;
									string strLengthValue = wrpDownload.GetResponseHeader("Content-length");
									if (String.IsNullOrEmpty(strLengthValue))
										return;
									intLineTracker = 15;
									intTotalFileLength = UInt64.Parse(strLengthValue);
									intLineTracker = 16;
									rngRetrievedRange = new Range(0, intTotalFileLength - 1);
									intLineTracker = 17;
								}
								intLineTracker = 18;
								if (intTotalFileLength != m_fmdInfo.Length)
									return;
								intLineTracker = 19;
								if (!rngRetrievedRange.IsSuperRangeOf(p_rngBlockToDownload))
									return;
								intLineTracker = 20;
								Stream stmData = null;
								try
								{
									stmData = wrpDownload.GetResponseStream();
									intLineTracker = 21;
									using (BufferedStream bsmBufferedData = new BufferedStream(stmData, m_intBufferSize))
									{
										stmData = null;
										intLineTracker = 22;
										byte[] bteBuffer = new byte[m_intBufferSize];
										Int32 intReadCount = 0;
										UInt64 intTotalRead = 0;
										intLineTracker = 23;
										while (m_booKeepRunning && ((intReadCount = bsmBufferedData.Read(bteBuffer, 0, m_intBufferSize)) > 0))
										{
											intLineTracker = 24;
											byte[] bteData = new byte[intReadCount];
											Array.Copy(bteBuffer, 0, bteData, 0, intReadCount);
											m_fwrWriter.EnqueueBlock(rngRetrievedRange.StartByte + intTotalRead, bteData);
											intLineTracker = 25;
											intTotalRead += (UInt64)intReadCount;
											m_intDownloadedByteCount += (UInt64)intReadCount;
										}
										intLineTracker = 26;
									}
									intLineTracker = 27;
								}
								finally
								{
									if (stmData != null)
									{
										stmData.Dispose();
									}
								}
								intLineTracker = 28;
							}
							intLineTracker = 29;
						}
						catch (WebException e)
						{
							intLineTracker = 31;
							Trace.TraceError(String.Format("[{0}] Block Downloader - Problem getting the block. Status: {1}, Message: {2}", m_fdrFileDownloader.URL, e.Status, e.Message));
							if (e.Response != null)
							{
								using (HttpWebResponse wrpDownload = (HttpWebResponse)e.Response)
								{
									intLineTracker = 32;
									switch (wrpDownload.StatusCode)
									{
										case HttpStatusCode.ServiceUnavailable:
											foreach (string strKey in wrpDownload.Headers.Keys)
											{
												switch (strKey)
												{
													case "NexusError":
														ErrorCode = wrpDownload.Headers.GetValues(strKey)[0];
														break;
													case "NexusErrorInfo":
														ErrorInfo = wrpDownload.Headers.GetValues(strKey)[0];
														break;
												}
											}

											if (ErrorCode == "666")
											{
												booRetry = false;
											}
											else if (wrpDownload.Headers.AllKeys[1] == "Retry-After")
												booRetry = true;
											else
											{
												intLineTracker = 33;
												booRetry = false;
												//this likely means the server has reached it's max
												// connection limit, so just do nothing
											}
											break;
									}
									intLineTracker = 34;
								}
							}
							intLineTracker = 35;
						}
						catch (IOException e)
						{
							intLineTracker = 36;
							Trace.TraceError(String.Format("[{0}] Block Downloader - Problem getting the block. Message: {1}", m_fdrFileDownloader.URL, e.Message));
							intLineTracker = 37;
						}
						intLineTracker = 38;
					}
				}
				catch (ArgumentOutOfRangeException)
				{
					Trace.TraceError(String.Format("[{0}] Block Downloader: ArgumentOutOfRangeException: LineTracker: {1}: Block Range {2}-{3}", m_fdrFileDownloader.URL, intLineTracker, p_rngBlockToDownload.StartByte, p_rngBlockToDownload.EndByte));
					throw;
				}
				catch (NullReferenceException)
				{
					Trace.TraceError(String.Format("[{0}] Block Downloader: NullReferenceException: LineTracker: {1}", m_fdrFileDownloader.URL, intLineTracker));
					throw;
				}
				return;
			}
		}
	}
}
