using System;
using System.Collections.Generic;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	public abstract class StringComparer<T> : IComparer<T>
		{
			private SortOrder m_sodOrder = SortOrder.Explicit;

			public StringComparer(SortOrder p_sodOrder)
			{
				m_sodOrder = p_sodOrder;
			}

			private Int32 DoStringCompare(string x, string y)
			{
				if (String.IsNullOrEmpty(x))
				{
					if (String.IsNullOrEmpty(y))
						return 0;
					return -1;
				}
				return x.CompareTo(y);
			}

			protected Int32 StringCompare(string x, string y)
			{
				switch (m_sodOrder)
				{
					case SortOrder.Ascending:
						return DoStringCompare(x, y);
					case SortOrder.Descending:
						return DoStringCompare(y, x);
					default:
						return 0;
				}
			}

			#region IComparer<InstallStep> Members

			public abstract int Compare(T x, T y);

			#endregion
		}
}
