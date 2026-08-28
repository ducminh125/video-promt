"use client";
import React, { useState } from 'react';

export default function Studio() {
  const [activeTab, setActiveTab] = useState<'video' | 'image'>('video');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState('');
  
  // Image Generation States
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    // Giả lập gọi API gpt-image-2-all từ https://shopaikey.com/
    setTimeout(() => {
      setGeneratedImageUrl('https://via.placeholder.com/512?text=AI+Generated+Image+by+Mai+Duc+Minh');
      setIsGeneratingImage(false);
    }, 2000);
  };

  const handleGenerateVideo = async () => {
    // Bổ sung prompt đồng nhất khuôn mặt ở Front-end trước khi gửi
    const finalPrompt = `${videoPrompt}\n\nYÊU CẦU QUAN TRỌNG: Người xuất hiện trong video này phải được giữ nguyên đồng nhất (về khuôn mặt, trang phục, ngoại hình) với người được gửi trong ảnh minh họa gốc.`;
    
    alert(`Đang gửi yêu cầu tạo video:\nPrompt: ${finalPrompt}\nẢnh: ${referenceImage}`);
    // Gọi API thực tế tại đây
  };

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Studio Sáng Tạo - Mai Đức Minh'web</h2>
      
      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b pb-2">
        <button 
          className={`font-bold px-6 py-2 rounded-t-lg transition-colors ${activeTab === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('video')}
        >
          Tạo Video AI
        </button>
        <button 
          className={`font-bold px-6 py-2 rounded-t-lg transition-colors ${activeTab === 'image' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          onClick={() => setActiveTab('image')}
        >
          Tạo Ảnh (gpt-image-2-all)
        </button>
      </div>

      {/* THẺ TẠO VIDEO */}
      {activeTab === 'video' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2">Bước 1: Tải lên hoặc chọn ảnh minh họa</h3>
            {/* GỢI Ý GIỌNG NÓI */}
            <div className="mt-2 mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-sm">
              <strong>💡 Gợi ý về giọng nói:</strong> Để video sinh động và chân thực hơn, hãy chuẩn bị trước kịch bản giọng nói rõ ràng hoặc cung cấp mô tả tông giọng (ví dụ: vui vẻ, trầm ấm, chuyên nghiệp...) sao cho phù hợp nhất với biểu cảm trong ảnh.
            </div>
            
            {referenceImage ? (
              <div className="flex flex-col items-start">
                <img src={referenceImage} alt="Reference" className="w-48 h-48 object-cover rounded-md border-2 border-green-500 shadow-sm" />
                <button onClick={() => setReferenceImage(null)} className="text-red-500 text-sm mt-2 hover:underline">Xóa ảnh minh họa</button>
              </div>
            ) : (
              <div className="h-32 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center text-gray-400 bg-gray-50">
                Chưa có ảnh minh họa. Hãy qua thẻ "Tạo Ảnh" để tạo ảnh mới hoặc tải lên.
              </div>
            )}
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2">Bước 2: Viết Prompt Video</h3>
            <textarea 
              className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              rows={4} 
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Mô tả hành động, bối cảnh trong video..."
            />
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2">Bước 3: Tùy chỉnh thông số</h3>
            <p className="text-sm text-gray-500">Tùy chọn tỷ lệ khung hình, chuyển động camera, thời lượng...</p>
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2">Bước 4: Tạo Video</h3>
            <button 
              onClick={handleGenerateVideo}
              className="bg-blue-600 text-white px-8 py-3 rounded-md font-bold hover:bg-blue-700 transition-colors shadow-md"
            >
              Bắt đầu tạo Video
            </button>
          </div>
        </div>
      )}

      {/* THẺ TẠO ẢNH */}
      {activeTab === 'image' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2 text-purple-700">Bước 1: Nhập ý tưởng ảnh (gpt-image-2-all)</h3>
            <textarea 
              className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none" 
              rows={4} 
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Mô tả chi tiết nhân vật, trang phục, bối cảnh cho ảnh..."
            />
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2 text-purple-700">Bước 2: Tùy chỉnh thông số</h3>
            <p className="text-sm text-gray-500">Kích thước ảnh, phong cách nghệ thuật, bộ lọc...</p>
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2 text-purple-700">Bước 3: Khởi tạo ảnh</h3>
            <button 
              onClick={handleGenerateImage}
              disabled={isGeneratingImage}
              className="bg-purple-600 text-white px-8 py-3 rounded-md font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-md flex items-center"
            >
              {isGeneratingImage ? 'Đang xử lý AI...' : 'Tạo Ảnh AI (gpt-image-2-all)'}
            </button>
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-2 text-purple-700">Bước 4: Kết quả & Ứng dụng</h3>
            {generatedImageUrl ? (
              <div className="flex flex-col items-start bg-gray-50 p-4 rounded-md border border-gray-200">
                <p className="text-sm text-green-600 font-semibold mb-3">Tạo ảnh thành công!</p>
                <img src={generatedImageUrl} alt="Generated AI" className="w-64 h-64 object-cover rounded-md shadow-sm mb-4 border border-gray-300" />
                
                {/* NÚT CHUYỂN SANG VIDEO */}
                <button 
                  onClick={() => {
                    setReferenceImage(generatedImageUrl); // Lưu ảnh vào state ảnh minh họa của Video
                    setActiveTab('video'); // Đổi tab
                  }}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-md font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  Chuyển sang làm ảnh minh họa cho Video
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Hình ảnh AI của bạn sẽ xuất hiện ở đây sau khi tạo.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
