using System;
using System.Collections;
using System.Collections.Generic;
using Util.Collections;

namespace Downloader
{
	/// <summary>
	/// A set of <see cref="Range"/>s.
	/// </summary>
	/// <remarks>
	/// Adding <see cref="Range"/>s to this set results in a minimal set. This means that
	/// as <see cref="Range"/>s are added they are merged with any existing intersecting
	/// ranges such that the set always contains the minimum number of <see cref="Range"/>s
	/// required to describe the ranges that the set covers.
	/// </remarks>
	public class RangeSet : IEnumerable<Range>
	{
		private SortedList<Range> m_sltRanges = new SortedList<Range>();

		/// <summary>
		/// Gets the total size of the <see cref="Range"/>s in the set.
		/// </summary>
		/// <value>The total size of the <see cref="Range"/>s in the set.</value>
		public UInt64 TotalSize
		{
			get
			{
				lock (m_sltRanges)
				{
					UInt64 intTotal = 0;
					foreach (Range rngRange in m_sltRanges)
						intTotal += rngRange.Size;
					return intTotal;
				}
			}
		}

		/// <summary>
		/// Adds the given <see cref="Range"/> to the set.
		/// </summary>
		/// <remarks>
		/// If the given <see cref="Range"/> intersects with any other
		/// <see cref="Range"/>s, it is merged with them.
		/// </remarks>
		/// <param name="p_rngNew">The range to add.</param>
		public void AddRange(Range p_rngNew)
		{
			Int32 intInsertIndex = m_sltRanges.IndexOf(p_rngNew);
			if (intInsertIndex >= 0)
				return;
			intInsertIndex = ~intInsertIndex;
			if ((intInsertIndex > 0) && (m_sltRanges[intInsertIndex - 1].IntersectsWith(p_rngNew) || m_sltRanges[intInsertIndex - 1].IsAdjacentTo(p_rngNew)))
			{
				m_sltRanges[intInsertIndex - 1].Merge(p_rngNew);
				if ((intInsertIndex < m_sltRanges.Count) && (m_sltRanges[intInsertIndex - 1].IntersectsWith(m_sltRanges[intInsertIndex]) || m_sltRanges[intInsertIndex - 1].IsAdjacentTo(m_sltRanges[intInsertIndex])))
				{
					m_sltRanges[intInsertIndex - 1].Merge(m_sltRanges[intInsertIndex]);
					m_sltRanges.RemoveAt(intInsertIndex);
				}
				return;
			}
			if ((intInsertIndex < m_sltRanges.Count) && (m_sltRanges[intInsertIndex].IntersectsWith(p_rngNew) || m_sltRanges[intInsertIndex].IsAdjacentTo(p_rngNew)))
			{
				m_sltRanges[intInsertIndex].Merge(p_rngNew);
				return;
			}
			m_sltRanges.Add(p_rngNew);

		}

		/// <summary>
		/// Removes the given <see cref="Range"/> from the set.
		/// </summary>
		/// <remarks>
		/// If the given <see cref="Range"/> intersects with any other
		/// <see cref="Range"/>s, the interesections are removed. This
		/// may result in a greater number of <see cref="Range"/>s.
		/// </remarks>
		/// <param name="p_rngOld">The range to remove.</param>
		public void RemoveRange(Range p_rngOld)
		{
			SortedList<Range> sltNewRanges = new SortedList<Range>();

			foreach (Range rngRange in m_sltRanges)
			{
				if (rngRange.IntersectsWith(p_rngOld))
				{
					Range rngNew = new Range(rngRange.StartByte, p_rngOld.StartByte - 1);
					if (rngNew.Size > 0)
						sltNewRanges.Add(rngNew);
					rngNew = new Range(p_rngOld.EndByte + 1, rngRange.EndByte);
					if (rngNew.Size > 0)
						sltNewRanges.Add(rngNew);
				}
				else
					sltNewRanges.Add(rngRange);
			}
			m_sltRanges = sltNewRanges;
		}

		#region IEnumerable<Range> Members

		/// <summary>
		/// Gets an enumerator for the items in the set.
		/// </summary>
		/// <returns>An enumerator for the items in the set.</returns>
		public IEnumerator<Range> GetEnumerator()
		{
			return m_sltRanges.GetEnumerator();
		}

		#endregion

		#region IEnumerable Members

		/// <summary>
		/// Gets an enumerator for the items in the set.
		/// </summary>
		/// <returns>An enumerator for the items in the set.</returns>
		IEnumerator IEnumerable.GetEnumerator()
		{
			return ((IEnumerable)m_sltRanges).GetEnumerator();
		}

		#endregion
	}
}
