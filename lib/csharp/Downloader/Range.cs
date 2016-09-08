using System;

namespace Downloader
{
	/// <summary>
	/// Defines a range in a file.
	/// </summary>
	/// <remarks>
	/// The defined range in inclusive of both the start and end bytes.
	/// </remarks>
	public class Range : IComparable<Range>, IEquatable<Range>
	{
		#region Properties

		/// <summary>
		/// Gets the start byte of the range.
		/// </summary>
		/// <remarks>
		/// The start byte is inclusive.
		/// </remarks>
		/// <value>The start byte of the range.</value>
		public UInt64 StartByte { get; private set; }

		/// <summary>
		/// Gets the end byte of the range.
		/// </summary>
		/// <remarks>
		/// The end byte is inclusive.
		/// </remarks>
		/// <value>The end byte of the range.</value>
		public UInt64 EndByte { get; private set; }

		/// <summary>
		/// Gets the size of the range.
		/// </summary>
		/// <value>The size of the range.</value>
		public UInt64 Size
		{
			get
			{
				return EndByte - StartByte + 1;
			}
		}


		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_intStartByte">The inclusive start byte of the range.</param>
		/// <param name="p_intEndByte">The inclusive end byte of the range.</param>
		public Range(UInt64 p_intStartByte, UInt64 p_intEndByte)
		{
			StartByte = p_intStartByte;
			EndByte = p_intEndByte;
		}

		#endregion

		#region IComparable<Range> Members

		/// <summary>
		/// Compares this <see cref="Range"/> to another.
		/// </summary>
		/// <remarks>
		/// <see cref="Range"/>s are strictly ordered by their <see cref="Range.StartByte"/>s, then
		/// by their <see cref="Range.EndByte"/>s.
		/// </remarks> 
		/// <param name="other">The <see cref="Range"/> to which to compare this <see cref="Range"/>.</param>
		/// <returns>A value less than 0 if this <see cref="Range"/> is less than the other.
		/// 0 if this <see cref="Range"/> is equal to the other.
		/// A value greater than 0 if this <see cref="Range"/> is greater than the other.</returns>
		public int CompareTo(Range other)
		{
			Int32 intResult = StartByte.CompareTo(other.StartByte);
			if (intResult == 0)
				intResult = EndByte.CompareTo(other.EndByte);
			return intResult;
		}

		#endregion

		#region IEquatable<Range> Members

		/// <summary>
		/// Determines if this <see cref="Range"/> is equal to the given
		/// <see cref="Range"/>.
		/// </summary>
		/// <remarks>
		/// Two <see cref="Range"/>s are equal if and only if their
		/// <see cref="Range.StartByte"/>s and <see cref="Range.EndByte"/>s
		/// are equal.
		/// </remarks>
		/// <param name="other">The <see cref="Range"/> to compare to this one.</param>
		/// <returns><c>true</c> if the two <see cref="Range"/>s are equal;
		/// <c>false</c> otherwise.</returns>
		public bool Equals(Range other)
		{
			return CompareTo(other) == 0;
		}

		#endregion

		/// <summary>
		/// Gets the hashcode to use for the given <see cref="Range"/>.
		/// </summary>
		/// <remarks>
		/// This override is needed to make (amongst other things) Dicitonaries work as expected when objects of
		/// this type are used as keys. <see cref="GetHashCode()"/> should be overridden whenever
		/// <see cref="Equals()"/> is overridden.
		/// </remarks>
		/// <returns>The hascode to use for the <see cref="Range"/>.</returns>
		public override int GetHashCode()
		{
			Int32 intHashCode = 53;
			intHashCode = intHashCode * 97 + (Int32)StartByte;
			intHashCode = intHashCode * 97 + (Int32)EndByte;
			return intHashCode;
		}

		/// <summary>
		/// Determines if this <see cref="Range"/> is equal to the specified
		/// range.
		/// </summary>
		/// <remarks>
		/// The <see cref="Range"/> is equal to the specified range if and only if
		/// <see cref="Range.StartByte"/> equals <paramref name="p_intStartByte"/>
		/// and <see cref="Range.EndByte"/> equals <paramref name="p_intEndByte"/>.
		/// </remarks>
		/// <param name="p_intStartByte">The inclusive start byte of the range to equate
		/// to this <see cref="Range"/>.</param>
		/// <param name="p_intEndByte">The inclusive end byte of the range to equate
		/// to this <see cref="Range"/>.</param>
		/// <returns><c>true</c> if this <see cref="Range"/> is equal to the specified range;
		/// <c>false</c> otherwise.</returns>
		public bool Equals(UInt64 p_intStartByte, UInt64 p_intEndByte)
		{
			return (StartByte == p_intStartByte) && (EndByte == p_intEndByte);
		}

		/// <summary>
		/// Determines if the given value is in this <see cref="Range"/>.
		/// </summary>
		/// <param name="p_intValue">The value for which it is to be determined if it is in this <see cref="Range"/>.</param>
		/// <returns><c>true</c> if the given value is in this <see cref="Range"/>;
		/// <c>false</c> otherwise.</returns>
		public bool Contains(UInt64 p_intValue)
		{
			return (StartByte <= p_intValue) && (p_intValue <= EndByte);
		}

		#region Overlap Detection

		/// <summary>
		/// Determines if the given <see cref="Range"/> intersects with this one.
		/// </summary>
		/// <param name="p_rngOther">The <see cref="Range"/> for which it is to be determined if it intersects
		/// with this <see cref="Range"/>.</param>
		/// <returns><c>true</c> if the given <see cref="Range"/> intersects with this one.</returns>
		public bool IntersectsWith(Range p_rngOther)
		{
			return Contains(p_rngOther.StartByte) || Contains(p_rngOther.EndByte) ||
					p_rngOther.Contains(StartByte);
		}

		/// <summary>
		/// Determines if the given <see cref="Range"/> is immediately adjacent to this one.
		/// </summary>
		/// <param name="p_rngOther">The <see cref="Range"/> for which it is to be determined if it is
		/// immediately adjacent to this <see cref="Range"/>.</param>
		/// <returns><c>true</c> if the given <see cref="Range"/> is immediately adjacent to this one.</returns>
		public bool IsAdjacentTo(Range p_rngOther)
		{
			return (p_rngOther.StartByte - EndByte == 1) || (StartByte - p_rngOther.EndByte == 1);
		}

		/// <summary>
		/// Deteremines if this <see cref="Range"/> is a sub-range of the
		/// given <see cref="Range"/>.
		/// </summary>
		/// <param name="p_rngOther">The <see cref="Range"/> for which it is to be determined
		/// if this <see cref="Range"/> is a sub-range.</param>
		/// <returns><c>true</c> if this <see cref="Range"/> is a sub-range of the
		/// given <see cref="Range"/>;
		/// <c>false</c> otherwise.</returns>
		public bool IsSubRangeOf(Range p_rngOther)
		{
			return p_rngOther.Contains(StartByte) && p_rngOther.Contains(EndByte);
		}

		/// <summary>
		/// Deteremines if this <see cref="Range"/> is a super-range of the
		/// given <see cref="Range"/>.
		/// </summary>
		/// <param name="p_rngOther">The <see cref="Range"/> for which it is to be determined
		/// if this <see cref="Range"/> is a super-range.</param>
		/// <returns><c>true</c> if this <see cref="Range"/> is a super-range of the
		/// given <see cref="Range"/>;
		/// <c>false</c> otherwise.</returns>
		public bool IsSuperRangeOf(Range p_rngOther)
		{
			return Contains(p_rngOther.StartByte) && Contains(p_rngOther.EndByte);
		}

		#endregion

		/// <summary>
		/// Merges the given <see cref="Range"/> with this one.
		/// </summary>
		/// <param name="p_rngOther">The <see cref="Range"/> to merge with this one.</param>
		/// <exception cref="ArgumentOutOfRangeException">Thrown if the given <see cref="Range"/>
		/// does not intersect with this <see cref="Range"/>.</exception>
		public void Merge(Range p_rngOther)
		{
			if (!IntersectsWith(p_rngOther) && !IsAdjacentTo(p_rngOther))
				throw new ArgumentOutOfRangeException("The given Range does not intersect with, and is not adjecent to, this Range.");
			if (IsSuperRangeOf(p_rngOther))
				return;
			if (IsSubRangeOf(p_rngOther))
			{
				StartByte = p_rngOther.StartByte;
				EndByte = p_rngOther.EndByte;
			}
			else if (CompareTo(p_rngOther) < 0)
				EndByte = p_rngOther.EndByte;
			else
				StartByte = p_rngOther.StartByte;
		}

		#region Serialization

		/// <summary>
		/// Returns a string representation of the <see cref="Range"/>.
		/// </summary>
		/// <returns>A string representation of the <see cref="Range"/>.</returns>
		public override string ToString()
		{
			return String.Format("{0}-{1}", StartByte, EndByte);
		}

		/// <summary>
		/// Parses a <see cref="Range"/> from the given string.
		/// </summary>
		/// <param name="p_strRange">The string representation of the <see cref="Range"/> to parse.</param>
		/// <returns>The <see cref="Range"/> represented by the given string.</returns>
		/// <exception cref="FormatException">Thrown if the given string in not in the correct format.</exception>
		public static Range Parse(string p_strRange)
		{
			string[] strRange = p_strRange.Split('-');
			if (strRange.Length != 2)
				throw new FormatException(String.Format("{0} is not in the correct format (#-#)", p_strRange));
			return new Range(UInt64.Parse(strRange[0]), UInt64.Parse(strRange[1]));
		}

		#endregion
	}
}
