const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const sampleProducts = [
  {
    name: "Áo thun unisex",
    description: "Áo thun cotton 100% chất lượng cao. Phù hợp phong cách trẻ trung năng động.",
    price: 199000,
    images: ["https://bizweb.dktcdn.net/100/446/974/products/ao-thun-mlb-new-era-heavy-cotton-new-york-yankees-black-13086578-1.jpg?v=1691318321487"],
    category: "Áo",
    subcategory: "Áo thun",
    brand: "Fashion Brand",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Trắng", "Xanh"],
    stock: [
      { size: "S", color: "Đen", quantity: 10 },
      { size: "M", color: "Đen", quantity: 15 },
      { size: "L", color: "Đen", quantity: 20 },
      { size: "S", color: "Trắng", quantity: 10 },
      { size: "M", color: "Trắng", quantity: 15 },
      { size: "L", color: "Xanh", quantity: 20 }
    ],
    tags: ["áo thun", "nam", "cotton"]
  },
  {
    name: "Quần jeans skinny",
    description: "Quần jeans co giãn, form skinny hiện đại. Sự lựa chọn tuyệt vời kết hợp với phong cách thể thao, năng động.",
    price: 450000,
    images: ["https://bizweb.dktcdn.net/100/358/889/products/z4515653784387-b7a3f2bce471341dc4047e984a14488c.jpg?v=1694676969750"],
    category: "Quần",
    subcategory: "Quần jeans",
    brand: "Denim Co",
    sizes: ["28", "30", "32", "34", "36"],
    colors: ["Xanh đậm", "Xanh nhạt", "Đen"],
    stock: [
      { size: "30", color: "Xanh đậm", quantity: 25 },
      { size: "32", color: "Xanh đậm", quantity: 30 },
      { size: "34", color: "Xanh đậm", quantity: 15 },
      { size: "30", color: "Xanh nhạt", quantity: 25 },
      { size: "32", color: "Đen", quantity: 30 },
      { size: "34", color: "Đen", quantity: 15 }
    ],
    tags: ["quần jeans", "nam", "skinny"]
  },
  {
    name: "Áo sơ mi trắng",
    description: "Áo sơ mi công sở, chất liệu cotton cao cấp",
    price: 350000,
    images: ["https://product.hstatic.net/200000588671/product/ao-so-mi-nam-bycotton-trang-art-nhan_8ec622a241ea4deb93a02bdbdcb87954.jpg"],
    category: "Áo",
    subcategory: "Áo sơ mi",
    brand: "Office Wear",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Trắng", "Xanh nhạt", "Hồng nhạt"],
    stock: [
      { size: "M", color: "Trắng", quantity: 40 },
      { size: "L", color: "Trắng", quantity: 35 },
      { size: "XL", color: "Trắng", quantity: 20 },
      { size: "M", color: "Xanh nhạt", quantity: 40 },
      { size: "L", color: "Xanh nhạt", quantity: 35 },
      { size: "XL", color: "Hồng nhạt", quantity: 20 }
    ],
    tags: ["áo sơ mi", "nam", "công sở"]
  },
  {
    name: "Đầm maxi hoa",
    description: "Đầm maxi họa tiết hoa, phong cách nữ tính",
    price: 520000,
    images: ["https://hoyang.vn/wp-content/uploads/2022/11/dam-suong-voan-lua.jpg"],
    category: "Đầm",
    subcategory: "Đầm dài",
    brand: "Floral Dreams",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Hoa đỏ", "Hoa xanh", "Hoa vàng"],
    stock: [
      { size: "S", color: "Hoa đỏ", quantity: 12 },
      { size: "M", color: "Hoa đỏ", quantity: 18 },
      { size: "L", color: "Hoa xanh", quantity: 10 },
      { size: "S", color: "Hoa vàng", quantity: 12 },
      { size: "M", color: "Hoa xanh", quantity: 18 },
      { size: "XL", color: "Hoa vàng", quantity: 10 }
    ],
    tags: ["đầm", "nữ", "hoa"]
  },
  {
    name: "Áo khoác bomber",
    description: "Áo khoác bomber thời trang, phong cách street style",
    price: 680000,
    images: ["https://bizweb.dktcdn.net/100/287/440/products/ao-khoac-bomber-local-brand-dep-mau-den-du-9.jpg?v=1668759858680"],
    category: "Áo khoác",
    subcategory: "Áo bomber",
    brand: "Street Style",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Đỏ"],
    stock: [
      { size: "M", color: "Đen", quantity: 8 },
      { size: "L", color: "Đỏ", quantity: 12 },
      { size: "XL", color: "Đen", quantity: 6 }
    ],
    tags: ["áo khoác", "unisex", "bomber"]
  },
  {
    name: "Chân váy chữ A",
    description: "Chân váy chữ A thanh lịch, phù hợp đi làm",
    price: 280000,
    images: ["https://bizweb.dktcdn.net/100/409/545/products/6643e100b7f415aa4ce5.jpg?v=1720670977003"],
    category: "Chân váy",
    subcategory: "Chân váy ngắn",
    brand: "Elegant",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Xám"],
    stock: [
      { size: "S", color: "Đen", quantity: 15 },
      { size: "M", color: "Xanh navy", quantity: 20 },
      { size: "L", color: "Đen", quantity: 12 }
    ],
    tags: ["chân váy", "nữ", "công sở"]
  },
  {
    name: "Áo hoodie",
    description: "Áo hoodie cotton blend, thoải mái và ấm áp",
    price: 390000,
    images: ["https://bumshop.com.vn/wp-content/uploads/2022/09/hoodie-tron-den-trum-dau.jpg"],
    category: "Áo",
    subcategory: "Áo hoodie",
    brand: "Comfort Zone",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Xám", "Đen", "Trắng", "Hồng"],
    stock: [
      { size: "M", color: "Xám", quantity: 25 },
      { size: "L", color: "Trắng", quantity: 30 },
      { size: "XL", color: "Hồng", quantity: 18 }
    ],
    tags: ["áo hoodie", "unisex", "thể thao"]
  },
  {
    name: "Quần short jean",
    description: "Quần short jean wash nhẹ, phong cách casual",
    price: 320000,
    images: ["https://cdn2.yame.vn/pimg/quan-short-lung-gai-duoi-goi-vai-jean-mac-ben-bieu-tuong-dang-vua-gia-tot-seventy-seven-29-0023381/551d724f-c094-2204-b62e-001c89222ba7.jpg?w=540&h=756"],
    category: "Quần",
    subcategory: "Quần short",
    brand: "Casual Wear",
    sizes: ["28", "30", "32", "34"],
    colors: ["Xanh nhạt", "Xanh đậm", "Trắng"],
    stock: [
      { size: "30", color: "Xanh nhạt", quantity: 22 },
      { size: "32", color: "Xanh nhạt", quantity: 28 },
      { size: "34", color: "Xanh nhạt", quantity: 15 }
    ],
    tags: ["quần short", "nam", "jean"]
  },
  {
    name: "Áo vest nữ",
    description: "Áo vest nhẹ nhàng, thiết kế thanh lịch",
    price: 295000,
    images: ["https://bizweb.dktcdn.net/100/409/545/products/z3736335329187-26811114e3579e0b34857df002c97241.jpg?v=1663731983503"],
    category: "Áo",
    subcategory: "Áo vest",
    brand: "Feminine",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Trắng", "Hồng nhạt", "Xanh mint"],
    stock: [
      { size: "S", color: "Trắng", quantity: 18 },
      { size: "M", color: "Hồng nhạt", quantity: 24 },
      { size: "L", color: "Xanh mint", quantity: 16 }
    ],
    tags: ["áo vest", "nữ", "thanh lịch"]
  },
  {
    name: "Áo vest nam",
    description: "Áo vest nam công sở, chất liệu cao cấp",
    price: 850000,
    images: ["https://vulcano.sgp1.digitaloceanspaces.com/media/19040/VSB3005A.webp"],
    category: "Áo khoác",
    subcategory: "Áo vest",
    brand: "Formal",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Đen", "Xanh navy", "Xám"],
    stock: [
      { size: "M", color: "Đen", quantity: 8 },
      { size: "L", color: "Đen", quantity: 12 },
      { size: "XL", color: "Đen", quantity: 6 },
      { size: "M", color: "Xanh navy", quantity: 8 },
      { size: "L", color: "Xám", quantity: 12 },
      { size: "XL", color: "Xám", quantity: 6 }
    ],
    tags: ["áo vest", "nam", "công sở"]
  },
  {
    name: "Đầm cocktail",
    description: "Đầm cocktail sang trọng, phù hợp dự tiệc",
    price: 750000,
    images: ["https://bizweb.dktcdn.net/100/180/839/products/drck0121-09-5-998-000-img-6934.jpg?v=1527324730633"],
    category: "Đầm",
    subcategory: "Đầm dự tiệc",
    brand: "Party Dresses",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Đỏ", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 5 },
      { size: "M", color: "Đỏ", quantity: 8 },
      { size: "L", color: "Xanh navy", quantity: 4 }
    ],
    tags: ["đầm", "nữ", "dự tiệc"]
  },
  {
    name: "Áo tank top",
    description: "Áo tank top basic, chất liệu cotton thoáng mát",
    price: 150000,
    images: ["https://pos.nvncdn.com/fa2431-2286/ps/20250519_9o7cqrmx16.jpeg"],
    category: "Áo",
    subcategory: "Áo tank top",
    brand: "Basic",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Trắng", "Đen", "Xám", "Hồng"],
    stock: [
      { size: "S", color: "Trắng", quantity: 30 },
      { size: "M", color: "Trắng", quantity: 35 },
      { size: "L", color: "Xám", quantity: 25 },
      { size: "S", color: "Xám", quantity: 30 },
      { size: "M", color: "Hồng", quantity: 35 },
      { size: "L", color: "Đen", quantity: 25 }
    ],
    tags: ["áo tank top", "nữ", "basic"]
  },
  {
    name: "Quần tây nam",
    description: "Quần tây nam dáng slim, phù hợp công sở",
    price: 420000,
    images: ["https://mattana.com.vn/uploads/products/2528/quan_tay_nam_classic_0_ly_mau_xanh_den_3.jpg"],
    category: "Quần",
    subcategory: "Quần tây",
    brand: "Office",
    sizes: ["28", "30", "32", "34", "36"],
    colors: ["Đen", "Xanh navy", "Xám", "Be"],
    stock: [
      { size: "30", color: "Đen", quantity: 15 },
      { size: "32", color: "Xám", quantity: 20 },
      { size: "34", color: "Be", quantity: 12 }
    ],
    tags: ["quần tây", "nam", "công sở"]
  },
  {
    name: "Áo crop top",
    description: "Áo crop top trendy, phong cách trẻ trung",
    price: 180000,
    images: ["https://bizweb.dktcdn.net/thumb/1024x1024/100/369/522/products/ao-croptop-nu-local-brand-dkmv-20.jpg"],
    category: "Áo",
    subcategory: "Áo crop top",
    brand: "Trendy",
    sizes: ["S", "M", "L"],
    colors: ["Trắng", "Đen", "Hồng", "Vàng"],
    stock: [
      { size: "S", color: "Trắng", quantity: 20 },
      { size: "M", color: "Đen", quantity: 25 },
      { size: "L", color: "Vàng", quantity: 15 }
    ],
    tags: ["áo crop top", "nữ", "trendy"]
  },
  {
    name: "Áo khoác denim",
    description: "Áo khoác denim classic, phong cách vintage",
    price: 540000,
    images: ["https://product.hstatic.net/200000642151/product/411360855_686508176929843_7436111648647845275_n_ac7c1206d4214e52a4c42ef3422882d6_master.jpg"],
    category: "Áo khoác",
    subcategory: "Áo khoác jean",
    brand: "Vintage",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Xanh nhạt", "Xanh đậm", "Đen"],
    stock: [
      { size: "M", color: "Xanh nhạt", quantity: 10 },
      { size: "L", color: "Xanh nhạt", quantity: 14 },
      { size: "XL", color: "Xanh nhạt", quantity: 8 }
    ],
    tags: ["áo khoác", "unisex", "denim"]
  },
  {
    name: "Quần legging",
    description: "Quần legging co giãn, phù hợp tập gym",
    price: 220000,
    images: ["https://product.hstatic.net/1000209952/product/z4333691784960_7f4de5928a87e886c85d655324125243_3d3d2b9005b04d60a1be794302a714a0_large.jpg"],
    category: "Quần",
    subcategory: "Quần legging",
    brand: "Active",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xám", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 25 },
      { size: "M", color: "Đen", quantity: 30 },
      { size: "L", color: "Đen", quantity: 20 }
    ],
    tags: ["quần legging", "nữ", "thể thao"]
  },
  {
    name: "Áo polo nam",
    description: "Áo polo nam classic, chất liệu pique cotton",
    price: 290000,
    images: ["https://product.hstatic.net/1000312752/product/548e103d31d2952b748f18f04406a434_37d5015da5cd409790f296c97c279909_89c4cdbacbc647a9a61c1b22fb4fa7b4.png"],
    category: "Áo",
    subcategory: "Áo polo",
    brand: "Classic",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Trắng", "Xanh navy", "Đen", "Đỏ"],
    stock: [
      { size: "M", color: "Trắng", quantity: 22 },
      { size: "L", color: "Trắng", quantity: 28 },
      { size: "XL", color: "Trắng", quantity: 15 }
    ],
    tags: ["áo polo", "nam", "classic"]
  },
  {
    name: "Đầm bodycon",
    description: "Đầm bodycon ôm dáng, phong cách gợi cảm",
    price: 480000,
    images: ["https://andora.com.vn/wp-content/uploads/2023/10/a0405db-1-web.jpg"],
    category: "Đầm",
    subcategory: "Đầm ngắn",
    brand: "Sexy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Đỏ", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 8 },
      { size: "M", color: "Đỏ", quantity: 12 },
      { size: "L", color: "Xanh navy", quantity: 6 }
    ],
    tags: ["đầm", "nữ", "bodycon"]
  },
  {
    name: "Áo cardigan",
    description: "Áo cardigan len mềm, phù hợp mùa đông. Kỹ thuật dệt kim cao cấp mang đến cảm giác mềm mại, với độ co giãn vừa phải rất thoải mái.",
    price: 450000,
    images: ["https://product.hstatic.net/200000588671/product/ao-khoac-nam-cao-cap-cardigan-mau-den-by-cotton_e6f9a4730f984a558e775f22a737b8a2_master.jpg"],
    category: "Áo khoác",
    subcategory: "Áo cardigan",
    brand: "Cozy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Be", "Xám", "Đen", "Trắng"],
    stock: [
      { size: "M", color: "Be", quantity: 15 },
      { size: "L", color: "Be", quantity: 18 },
      { size: "XL", color: "Be", quantity: 10 }
    ],
    tags: ["áo cardigan", "nữ", "len"]
  },
  {
    name: "Quần jogger",
    description: "Quần jogger thể thao, chất liệu cotton blend",
    price: 340000,
    images: ["https://pos.nvncdn.com/be3159-662/ps/20240920_qaxEjCZYjg.jpeg"],
    category: "Quần",
    subcategory: "Quần jogger",
    brand: "Sport",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Xám", "Đen", "Xanh navy"],
    stock: [
      { size: "M", color: "Xám", quantity: 20 },
      { size: "L", color: "Xám", quantity: 25 },
      { size: "XL", color: "Xám", quantity: 15 }
    ],
    tags: ["quần jogger", "unisex", "thể thao"]
  },
  {
    name: "Áo thun nữ",
    description: "Áo thun nữ form fitted, chất liệu cotton cao cấp. Phong cách trẻ trung, năng động.",
    price: 185000,
    images: ["https://product.hstatic.net/1000003969/product/den_jnath049_1_20240402135332_1ed0cdda1eea4401b178f9305a0af6af_master.jpeg"],
    category: "Áo",
    subcategory: "Áo thun",
    brand: "Feminine",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Trắng", "Đen", "Hồng", "Xanh"],
    stock: [
      { size: "S", color: "Trắng", quantity: 25 },
      { size: "M", color: "Trắng", quantity: 30 },
      { size: "L", color: "Trắng", quantity: 20 }
    ],
    tags: ["áo thun", "nữ", "fitted"]
  },
  {
    name: "Chân váy midi",
    description: "Chân váy midi xòe, phong cách vintage. Phong cách, cá tính",
    price: 380000,
    images: ["https://product.hstatic.net/200000000133/product/25sote051t_-_25scve030d.1_9ec10e9fb1b14c39b2215ba9d53e187d_master.jpg"],
    category: "Chân váy",
    subcategory: "Chân váy dài",
    brand: "Vintage",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Đỏ"],
    stock: [
      { size: "S", color: "Đen", quantity: 12 },
      { size: "M", color: "Đen", quantity: 16 },
      { size: "L", color: "Đen", quantity: 10 }
    ],
    tags: ["chân váy", "nữ", "midi"]
  },
  {
    name: "Áo sweatshirt",
    description: "Áo sweatshirt oversize, phong cách streetwear. Phù hợp mọi trang phục. Thiết kế đơn giản, tiện lợi.",
    price: 420000,
    images: ["https://aeonmall-review-rikkei.cdn.vccloud.vn/public/image/ecommerce/products/cTKIlzFnXwRgqYKTl6tlV7qWgvw584dSEyW3WHSd.jpg"],
    category: "Áo",
    subcategory: "Áo sweatshirt",
    brand: "Streetwear",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Xám", "Đen", "Trắng", "Hồng"],
    stock: [
      { size: "M", color: "Xám", quantity: 18 },
      { size: "L", color: "Xám", quantity: 22 },
      { size: "XL", color: "Xám", quantity: 12 }
    ],
    tags: ["áo sweatshirt", "unisex", "oversize"]
  },
  {
    name: "Quần culottes",
    description: "Quần culottes wide leg, phong cách hiện đại",
    price: 360000,
    images: ["https://cdn.kkfashion.vn/14986-large_default/quan-culottes-nu-dang-lung-ong-rong-qcs02-33.jpg"],
    category: "Quần",
    subcategory: "Quần culottes",
    brand: "Modern",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Be", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 14 },
      { size: "M", color: "Đen", quantity: 18 },
      { size: "L", color: "Đen", quantity: 12 }
    ],
    tags: ["quần culottes", "nữ", "wide leg"]
  },
  {
    name: "Áo blazer nữ",
    description: "Áo blazer nữ công sở, thiết kế thanh lịch",
    price: 680000,
    images: ["https://bovest.vn/wp-content/uploads/2024/10/ao-khoac-mau-xam-2.jpg"],
    category: "Áo khoác",
    subcategory: "Áo blazer",
    brand: "Professional",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Xám", "Be"],
    stock: [
      { size: "M", color: "Đen", quantity: 10 },
      { size: "L", color: "Đen", quantity: 12 },
      { size: "XL", color: "Đen", quantity: 8 }
    ],
    tags: ["áo blazer", "nữ", "công sở"]
  },
  {
    name: "Đầm shift",
    description: "Đầm shift đơn giản, phù hợp đi làm",
    price: 420000,
    images: ["https://image.hm.com/assets/hm/17/67/1767967ae74a1275fb1d3386ac610122f6e1b13e.jpg?imwidth=2160"],
    category: "Đầm",
    subcategory: "Đầm công sở",
    brand: "Office",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Xám"],
    stock: [
      { size: "S", color: "Đen", quantity: 15 },
      { size: "M", color: "Đen", quantity: 20 },
      { size: "L", color: "Đen", quantity: 12 }
    ],
    tags: ["đầm", "nữ", "công sở"]
  },
  {
    name: "Áo thun polo nữ",
    description: "Áo thun polo nữ, phong cách preppy",
    price: 250000,
    images: ["https://deltasport.vn/wp-content/uploads/2024/02/PO049W0-ao-polo-nu-trang-439K-2-1.png"],
    category: "Áo",
    subcategory: "Áo polo",
    brand: "Preppy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Trắng", "Hồng", "Xanh mint", "Xanh navy"],
    stock: [
      { size: "S", color: "Trắng", quantity: 18 },
      { size: "M", color: "Trắng", quantity: 22 },
      { size: "L", color: "Trắng", quantity: 15 }
    ],
    tags: ["áo polo", "nữ", "preppy"]
  },
  {
    name: "Quần shorts thể thao",
    description: "Quần shorts thể thao, chất liệu thoáng khí",
    price: 180000,
    images: ["https://product.hstatic.net/200000805635/product/dscf0615_0bf000ef5f23407d863e124b909b23be.jpg"],
    category: "Quần",
    subcategory: "Quần short",
    brand: "Active",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xám", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 20 },
      { size: "M", color: "Đen", quantity: 25 },
      { size: "L", color: "Đen", quantity: 18 }
    ],
    tags: ["quần shorts", "unisex", "thể thao"]
  },
  {
    name: "Áo len cổ tròn",
    description: "Áo len cổ tròn basic, ấm áp và thoải mái",
    price: 380000,
    images: ["https://linhvnxk.com/wp-content/uploads/2018/10/Ao-len-nam-co-tron-uniqlo-mau-xanh-navy.jpg"],
    category: "Áo",
    subcategory: "Áo len",
    brand: "Cozy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Be", "Xám", "Đen", "Trắng"],
    stock: [
      { size: "M", color: "Be", quantity: 16 },
      { size: "L", color: "Be", quantity: 20 },
      { size: "XL", color: "Be", quantity: 12 }
    ],
    tags: ["áo len", "unisex", "basic"]
  },
  {
    name: "Chân váy bút chì",
    description: "Chân váy bút chì ôm dáng, phong cách công sở",
    price: 320000,
    images: ["https://bizweb.dktcdn.net/100/449/686/products/mira1-3086deed-52e0-41f3-ae5a-25a4e29bee34.jpg?v=1664708870773"],
    category: "Chân váy",
    subcategory: "Chân váy ngắn",
    brand: "Office",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Xám"],
    stock: [
      { size: "S", color: "Đen", quantity: 14 },
      { size: "M", color: "Đen", quantity: 18 },
      { size: "L", color: "Đen", quantity: 10 }
    ],
    tags: ["chân váy", "nữ", "bút chì"]
  },
  {
    name: "Áo khoác da",
    description: "Áo khoác da thật, phong cách rock chic",
    price: 1200000,
    images: ["https://tamanh.net/wp-content/uploads/2024/12/ao-khoac-da-racer-jacket-ADTA81-8102-D-1.jpg"],
    category: "Áo khoác",
    subcategory: "Áo khoác da",
    brand: "Rock Style",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Nâu"],
    stock: [
      { size: "M", color: "Đen", quantity: 5 },
      { size: "L", color: "Đen", quantity: 6 },
      { size: "XL", color: "Đen", quantity: 3 }
    ],
    tags: ["áo khoác", "unisex", "da"]
  },
  {
    name: "Đầm wrap",
    description: "Đầm wrap nữ tính, phù hợp nhiều dáng người",
    price: 460000,
    images: ["https://product.hstatic.net/1000026602/product/csh_5758_5a30d83c504f40a3ab4dd212269ae0d9_master.jpg"],
    category: "Đầm",
    subcategory: "Đầm wrap",
    brand: "Feminine",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đỏ", "Xanh navy", "Hoa nhí"],
    stock: [
      { size: "S", color: "Đỏ", quantity: 10 },
      { size: "M", color: "Đỏ", quantity: 14 },
      { size: "L", color: "Đỏ", quantity: 8 }
    ],
    tags: ["đầm", "nữ", "wrap"]
  },
  {
    name: "Áo thun tay dài",
    description: "Áo thun tay dài basic, chất liệu cotton thoáng mát",
    price: 220000,
    images: ["https://img.muji.net/img/item/4550512150848_1260.jpg"],
    category: "Áo",
    subcategory: "Áo thun",
    brand: "Basic",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Trắng", "Đen", "Xám", "Xanh navy"],
    stock: [
      { size: "M", color: "Trắng", quantity: 25 },
      { size: "L", color: "Trắng", quantity: 30 },
      { size: "XL", color: "Trắng", quantity: 20 }
    ],
    tags: ["áo thun", "unisex", "tay dài"]
  },
  {
    name: "Quần palazzo",
    description: "Quần palazzo wide leg, thoải mái và thời trang",
    price: 390000,
    images: ["https://static.massimodutti.net/assets/public/1690/bd05/085c4632a906/bf9cacfb093e/05038538800-o6/05038538800-o6.jpg?ts=1740659248720"],
    category: "Quần",
    subcategory: "Quần palazzo",
    brand: "Flowy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Be", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 12 },
      { size: "M", color: "Đen", quantity: 16 },
      { size: "L", color: "Đen", quantity: 10 }
    ],
    tags: ["quần palazzo", "nữ", "wide leg"]
  },
  {
    name: "Áo kimonon",
    description: "Áo kimono nhẹ nhàng, phong cách boho chic",
    price: 320000,
    images: ["https://down-vn.img.susercontent.com/file/vn-11134207-7qukw-lji59hxd8ypg1e_tn.webp"],
    category: "Áo khoác",
    subcategory: "Áo kimono",
    brand: "Boho",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Hoa nhiều màu", "Đen", "Trắng"],
    stock: [
      { size: "M", color: "Hoa nhiều màu", quantity: 8 },
      { size: "L", color: "Hoa nhiều màu", quantity: 10 },
      { size: "XL", color: "Hoa nhiều màu", quantity: 6 }
    ],
    tags: ["áo kimono", "nữ", "boho"]
  },
  {
    name: "Quần kaki nam",
    description: "Quần kaki nam dáng slim, phù hợp đi làm",
    price: 380000,
    images: ["https://4menshop.com/images/thumbs/2020/11/quan-kaki-tron-can-ban-qk004-mau-den-15675.png"],
    category: "Quần",
    subcategory: "Quần kaki",
    brand: "Casual",
    sizes: ["28", "30", "32", "34", "36"],
    colors: ["Be", "Xám", "Xanh navy", "Đen"],
    stock: [
      { size: "30", color: "Be", quantity: 18 },
      { size: "32", color: "Be", quantity: 22 },
      { size: "34", color: "Be", quantity: 15 }
    ],
    tags: ["quần kaki", "nam", "slim"]
  },
  {
    name: "Áo bra thể thao",
    description: "Áo bra thể thao support tốt, phù hợp tập luyện",
    price: 280000,
    images: ["https://kiwisport.vn/wp-content/uploads/2021/10/ao-bra-the-thao-nu-mau-den-chat-det-quang-chau.jpg"],
    category: "Áo",
    subcategory: "Áo bra",
    brand: "Active",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xám", "Hồng", "Xanh"],
    stock: [
      { size: "S", color: "Đen", quantity: 15 },
      { size: "M", color: "Đen", quantity: 20 },
      { size: "L", color: "Đen", quantity: 12 }
    ],
    tags: ["áo bra", "nữ", "thể thao"]
  },
  {
    name: "Jumpsuit",
    description: "Jumpsuit dài tay, phong cách hiện đại",
    price: 580000,
    images: ["https://carolina.net.au/cdn/shop/files/47_Jude_JUmpsuit_Black.jpg?v=1724919138"],
    category: "Jumpsuit",
    subcategory: "Jumpsuit dài",
    brand: "Modern",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xanh navy", "Đỏ"],
    stock: [
      { size: "S", color: "Đen", quantity: 8 },
      { size: "M", color: "Đen", quantity: 12 },
      { size: "L", color: "Đen", quantity: 6 }
    ],
    tags: ["jumpsuit", "nữ", "dài tay"]
  },
  {
    name: "Áo sơ mi flannel",
    description: "Áo sơ mi flannel ấm áp, phong cách casual",
    price: 350000,
    images: ["https://pos.nvncdn.com/492284-9176/ps/20221117_Rf1ZpK0j70WukbQINhtzFLRv.png"],
    category: "Áo",
    subcategory: "Áo sơ mi",
    brand: "Casual",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Caro đỏ", "Caro xanh", "Caro xám"],
    stock: [
      { size: "M", color: "Caro đỏ", quantity: 15 },
      { size: "L", color: "Caro đỏ", quantity: 18 },
      { size: "XL", color: "Caro đỏ", quantity: 12 }
    ],
    tags: ["áo sơ mi", "unisex", "flannel"]
  },
  {
    name: "Quần skinny nữ",
    description: "Quần skinny nữ co giãn, ôm dáng hoàn hảo",
    price: 320000,
    images: ["https://sithimy.s3.ap-southeast-1.amazonaws.com/sithimy/media/Wrvms9K59gA8CzMW5AEaD0zyVVXPFzLa9ogdddnJ.jpg"],
    category: "Quần",
    subcategory: "Quần skinny",
    brand: "Fitted",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Xám", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 18 },
      { size: "M", color: "Đen", quantity: 22 },
      { size: "L", color: "Đen", quantity: 15 }
    ],
    tags: ["quần skinny", "nữ", "co giãn"]
  },
  {
    name: "Áo len vest",
    description: "Áo len vest không tay, phong cách preppy",
    price: 290000,
    images: ["https://trungnien.vn/wp-content/uploads/2024/08/2-79.jpg"],
    category: "Áo",
    subcategory: "Áo len",
    brand: "Preppy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Be", "Xám", "Xanh navy"],
    stock: [
      { size: "M", color: "Be", quantity: 12 },
      { size: "L", color: "Be", quantity: 15 },
      { size: "XL", color: "Be", quantity: 8 }
    ],
    tags: ["áo len", "unisex", "vest"]
  },
  {
    name: "Đầm shirt dress",
    description: "Đầm shirt dress dáng suông, phong cách effortless",
    price: 420000,
    images: ["https://product.hstatic.net/1000053720/product/ai_generated_image_2025-06-18-2_2cad41f2beb443fbbfafd27f7347be9a_grande.png"],
    category: "Đầm",
    subcategory: "Đầm shirt",
    brand: "Effortless",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Trắng", "Xanh nhạt", "Caro"],
    stock: [
      { size: "S", color: "Trắng", quantity: 10 },
      { size: "M", color: "Trắng", quantity: 14 },
      { size: "L", color: "Trắng", quantity: 8 }
    ],
    tags: ["đầm", "nữ", "shirt dress"]
  },
  {
    name: "Áo thun graphic",
    description: "Áo thun in hình, phong cách street style",
    price: 240000,
    images: ["https://n7media.coolmate.me/uploads/March2024/stitchsufr8.jpg"],
    category: "Áo",
    subcategory: "Áo thun",
    brand: "Street",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Đen", "Trắng", "Xám"],
    stock: [
      { size: "M", color: "Đen", quantity: 20 },
      { size: "L", color: "Đen", quantity: 25 },
      { size: "XL", color: "Đen", quantity: 15 }
    ],
    tags: ["áo thun", "unisex", "graphic"]
  },
  {
    name: "Quần cargo",
    description: "Quần cargo nhiều túi, phong cách utility",
    price: 480000,
    images: ["https://zizoou.com/cdn/shop/files/Quan-tui-hop-kaki-cao-cap-Quan-jogger-unisex-vang-be-khaki-7-1.jpg?v=1698800965"],
    category: "Quần",
    subcategory: "Quần cargo",
    brand: "Utility",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Xanh rêu", "Đen", "Be"],
    stock: [
      { size: "M", color: "Xanh rêu", quantity: 12 },
      { size: "L", color: "Xanh rêu", quantity: 15 },
      { size: "XL", color: "Xanh rêu", quantity: 10 }
    ],
    tags: ["quần cargo", "unisex", "utility"]
  },
  {
    name: "Áo croptop hoodie",
    description: "Áo croptop hoodie trendy, phong cách Y2K",
    price: 350000,
    images: ["https://deltasport.vn/wp-content/uploads/2024/11/HD025W0-ao-hoodie-croptop-nu-409K-7-510x765.jpg"],
    category: "Áo",
    subcategory: "Áo hoodie",
    brand: "Y2K",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Hồng", "Xanh mint", "Tím", "Trắng"],
    stock: [
      { size: "S", color: "Hồng", quantity: 15 },
      { size: "M", color: "Hồng", quantity: 18 },
      { size: "L", color: "Hồng", quantity: 12 }
    ],
    tags: ["áo hoodie", "nữ", "croptop"]
  },
  {
    name: "Chân váy tennis",
    description: "Chân váy tennis xòe, phong cách thể thao",
    price: 260000,
    images: ["https://file.hstatic.net/200000503583/file/chan-vay-tennis-mac-voi-ao-gi__4__b102ec72c56b468d8cf8ac9bf36bb1b2.jpg"],
    category: "Chân váy",
    subcategory: "Chân váy ngắn",
    brand: "Sport",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Trắng", "Xanh navy", "Đen"],
    stock: [
      { size: "S", color: "Trắng", quantity: 16 },
      { size: "M", color: "Trắng", quantity: 20 },
      { size: "L", color: "Trắng", quantity: 14 }
    ],
    tags: ["chân váy", "nữ", "tennis"]
  },
  {
    name: "Áo khoác windbreaker",
    description: "Áo khoác windbreaker chống gió, phong cách sporty",
    price: 520000,
    images: ["https://bizweb.dktcdn.net/100/347/212/products/068abe884a76f57dc2f0fc90f3f90cea71abc0e3.jpg?v=1726883997390"],
    category: "Áo khoác",
    subcategory: "Áo khoác gió",
    brand: "Sport",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Đen", "Xanh navy", "Xám"],
    stock: [
      { size: "M", color: "Đen", quantity: 10 },
      { size: "L", color: "Đen", quantity: 12 },
      { size: "XL", color: "Đen", quantity: 8 }
    ],
    tags: ["áo khoác", "unisex", "windbreaker"]
  },
  {
    name: "Quần wide leg",
    description: "Quần wide leg suông rộng, phong cách retro",
    price: 420000,
    images: ["https://tarmor.vn/wp-content/uploads/2023/01/wide-leg-1-1.jpg"],
    category: "Quần",
    subcategory: "Quần wide leg",
    brand: "Retro",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Be", "Xanh navy"],
    stock: [
      { size: "S", color: "Đen", quantity: 12 },
      { size: "M", color: "Đen", quantity: 16 },
      { size: "L", color: "Đen", quantity: 10 }
    ],
    tags: ["quần wide leg", "nữ", "retro"]
  },
  {
    name: "Áo tube top",
    description: "Áo tube top không dây, phong cách sexy",
    price: 160000,
    images: ["https://andora.com.vn/wp-content/uploads/2022/10/A0106T-1-andora.jpg"],
    category: "Áo",
    subcategory: "Áo tube top",
    brand: "Sexy",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Đen", "Trắng", "Đỏ", "Hồng"],
    stock: [
      { size: "S", color: "Đen", quantity: 18 },
      { size: "M", color: "Đen", quantity: 22 },
      { size: "L", color: "Đen", quantity: 15 }
    ],
    tags: ["áo tube top", "nữ", "sexy"]
  }
];

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion-shop')
  .then(async () => {
    await Product.insertMany(sampleProducts);
    console.log('Sample products added!');
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });