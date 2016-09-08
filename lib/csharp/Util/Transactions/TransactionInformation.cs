using System;

namespace Util.Transactions
{
	/// <summary>
	/// The possible statuses of a transaction.
	/// </summary>
	public enum TransactionStatus
	{
		Active,
		Committed,
		Aborted,
		InDoubt
	}

	/// <summary>
	/// Information about a transaction.
	/// </summary>
	public class TransactionInformation
	{
		private TransactionStatus m_tstStatus = TransactionStatus.Active;
		private string m_strLocalIdentifier = Guid.NewGuid().ToString();

		/// <summary>
		/// Gets the status of the transaction.
		/// </summary>
		/// <value>The status of the transaction.</value>
		public TransactionStatus Status
		{
			get
			{
				return m_tstStatus;
			}
			internal set
			{
				m_tstStatus = value;
			}
		}

		/// <summary>
		/// Gets the unique identifier of the transaction.
		/// </summary>
		/// <value>The unique identifier of the transaction.</value>
		public string LocalIdentifier
		{
			get
			{
				return m_strLocalIdentifier;
			}
		}
	}
}
