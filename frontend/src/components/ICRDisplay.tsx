interface ICRData {
  value: number;
  confidence: number;
  timestamp: number;
  sources: string[];
}

interface Props {
  data: ICRData | null;
  loading: boolean;
}

export function ICRDisplay({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-2">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="text-center py-8">
          <p className="text-gray-500">No ICR data available</p>
        </div>
      </div>
    );
  }

  const icrPercent = data.value;
  const icrBps = icrPercent * 100;
  const confidenceBps = data.confidence * 100;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Internet Credit Rate (ICR)
        </h2>
        <span className="text-xs text-gray-500">
          ±{confidenceBps.toFixed(0)} bps
        </span>
      </div>

      {/* ICR Value */}
      <div className="bg-purple-50 rounded-lg p-6 mb-4">
        <div className="text-center">
          <div className="text-5xl font-bold text-purple-600 mb-2">
            {icrPercent.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-600">
            {icrBps.toFixed(0)} basis points
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Data Sources
        </div>
        {data.sources.map((source, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="font-medium text-gray-900 capitalize">
                {source}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {icrPercent.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">
                Weight: {(100 / data.sources.length).toFixed(0)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confidence Interval */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Confidence Range</span>
          <span className="font-medium text-gray-900">
            {(icrPercent - data.confidence).toFixed(2)}% - {(icrPercent + data.confidence).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
